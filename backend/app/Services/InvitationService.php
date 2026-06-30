<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use App\Exceptions\Domain\InvitationAlreadyMemberException;
use App\Exceptions\Domain\InvitationAlreadyPendingException;
use App\Exceptions\Domain\InvitationEmailMismatchException;
use App\Exceptions\Domain\InvitationExpiredException;
use App\Exceptions\Domain\InvitationNotFoundException;
use App\Exceptions\Domain\InvitationNotPendingException;
use App\Exceptions\Domain\InvitationRateLimitException;
use App\Exceptions\Domain\InvitationRevokedException;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Use cases for the {@see Invitation} aggregate — ADR-013.
 *
 * Every state-changing public method runs inside `DB::transaction()` so
 * partial state never leaks. Token mechanics (mint / hash / lookup) live
 * in {@see InvitationTokenIssuer}; the raw token is never persisted —
 * only its SHA-256 digest lives in `token_hash`. Rate limit: 20 issuances
 * per rolling 24h per org, counted inside the transaction so concurrent
 * callers cannot both squeak past. Email delivery is queued and dispatched
 * after commit (R11) — see {@see dispatchInvitationMail()}.
 */
class InvitationService
{
    private const TTL_DAYS = 7;

    private const RATE_LIMIT_WINDOW_HOURS = 24;

    private const RATE_LIMIT_MAX = 20;

    /**
     * Minimum gap between two resends of the SAME invitation — follow-up
     * R1. The org-wide issuance limit counts rows by `created_at`, which
     * resend() never touches (it mutates an existing row), so without this
     * a single invite could be re-sent unbounded times, spamming the
     * recipient. Matches the "1 per minute per invite" contract assumed by
     * the invite spec (`00-overview.md` §7.4).
     */
    private const RESEND_COOLDOWN_SECONDS = 60;

    public function __construct(
        private readonly InvitationTokenIssuer $tokens,
    ) {}

    /**
     * @return array{invitation: Invitation, token: string}
     *
     * @throws InvitationAlreadyMemberException
     * @throws InvitationAlreadyPendingException
     * @throws InvitationRateLimitException
     */
    public function invite(
        Organization $organization,
        User $inviter,
        string $email,
        MembershipRole $role,
    ): array {
        $normalised = $this->normaliseEmail($email);

        return DB::transaction(function () use ($organization, $inviter, $normalised, $role): array {
            $this->guardRateLimit($organization);
            $this->guardAlreadyMember($organization, $normalised);
            $this->guardAlreadyPending($organization, $normalised);

            $token = $this->tokens->generate();
            $invitation = Invitation::create([
                'organization_id' => $organization->id,
                'email' => $normalised,
                'role' => $role->value,
                'token_hash' => $this->tokens->hash($token),
                'status' => InvitationStatus::Pending->value,
                'expires_at' => Carbon::now()->addDays(self::TTL_DAYS),
                'invited_by_user_id' => $inviter->id,
            ]);

            $invitation->setRelation('invitedBy', $inviter);
            $invitation->setRelation('organization', $organization);

            $this->dispatchInvitationMail($invitation, $token);

            return ['invitation' => $invitation, 'token' => $token];
        });
    }

    /**
     * Idempotent: revoking an already-revoked / non-pending row is a
     * silent no-op (avoids confusing double-click UX in the modal).
     */
    public function revoke(Invitation $invitation): void
    {
        if ($invitation->status !== InvitationStatus::Pending) {
            return;
        }

        $invitation->status = InvitationStatus::Revoked;
        $invitation->revoked_at = Carbon::now();
        $invitation->save();
    }

    /**
     * Regenerate token, reset `expires_at`, fire a new email.
     *
     * @return array{invitation: Invitation, token: string}
     *
     * @throws InvitationNotPendingException
     * @throws InvitationRateLimitException
     */
    public function resend(Invitation $invitation): array
    {
        if ($invitation->status !== InvitationStatus::Pending) {
            throw new InvitationNotPendingException;
        }

        return DB::transaction(function () use ($invitation): array {
            /** @var Invitation $fresh */
            $fresh = Invitation::query()
                ->whereKey($invitation->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-check after the lock — a parallel accept/revoke
            // between policy resolution and this transaction is caught.
            if ($fresh->status !== InvitationStatus::Pending) {
                throw new InvitationNotPendingException;
            }

            $this->guardResendCooldown($fresh);

            $organization = $fresh->organization()->firstOrFail();
            $this->guardRateLimit($organization);

            $token = $this->tokens->generate();
            $fresh->token_hash = $this->tokens->hash($token);
            $fresh->expires_at = Carbon::now()->addDays(self::TTL_DAYS);
            $fresh->last_resent_at = Carbon::now();
            $fresh->save();
            $fresh->load(['invitedBy', 'organization']);

            $this->dispatchInvitationMail($fresh, $token);

            return ['invitation' => $fresh, 'token' => $token];
        });
    }

    /**
     * Idempotent: if `$acceptor` already accepted this invite (or is
     * already an active member via another path) returns the existing
     * membership instead of throwing.
     *
     * @throws InvitationNotFoundException
     * @throws InvitationExpiredException
     * @throws InvitationRevokedException
     * @throws InvitationEmailMismatchException
     */
    public function accept(string $rawToken, User $acceptor): Membership
    {
        // Stale-pending promotion runs in its OWN short transaction so
        // the promote-to-expired survives even when the outer accept
        // transaction rolls back from a thrown InvitationExpiredException.
        // We peek at the row outside the lock first; the lock inside the
        // accept transaction is the authoritative one for the actual
        // state transition.
        $this->maybePromoteExpired($rawToken);

        return DB::transaction(function () use ($rawToken, $acceptor): Membership {
            $invitation = $this->tokens->findForUpdate($rawToken);
            $this->guardAcceptable($invitation, $acceptor);

            if ($invitation->status === InvitationStatus::Accepted) {
                if ($invitation->accepted_by_user_id === $acceptor->id) {
                    return $this->existingActiveMembership($invitation, $acceptor);
                }

                // A different user already consumed this token — the
                // link is no longer usable for anyone else.
                throw new InvitationRevokedException;
            }

            $membership = $this->upsertMembership($invitation, $acceptor);

            $invitation->status = InvitationStatus::Accepted;
            $invitation->accepted_at = Carbon::now();
            $invitation->accepted_by_user_id = $acceptor->id;
            $invitation->save();

            return $membership;
        });
    }

    /**
     * Mark the invitation as revoked without creating a membership.
     * Idempotent against non-pending rows.
     *
     * @throws InvitationNotFoundException
     * @throws InvitationEmailMismatchException
     */
    public function decline(string $rawToken, User $acceptor): void
    {
        // Same expired-promotion contract as accept(): runs in its own
        // transaction so the state change persists if we throw later.
        $this->maybePromoteExpired($rawToken);

        DB::transaction(function () use ($rawToken, $acceptor): void {
            $invitation = $this->tokens->findForUpdate($rawToken);

            if ($invitation->status !== InvitationStatus::Pending) {
                return;
            }

            if (Str::lower(trim($acceptor->email)) !== $invitation->email) {
                throw new InvitationEmailMismatchException;
            }

            $invitation->status = InvitationStatus::Revoked;
            $invitation->revoked_at = Carbon::now();
            $invitation->save();
        });
    }

    /**
     * Preview WITHOUT consuming. Returns a flat dict (the controller
     * wraps it under `{data}`). Returning 200 even for not_found /
     * expired flattens the token-enumeration surface.
     *
     * @return array<string, mixed>
     */
    public function previewByToken(string $rawToken): array
    {
        $invitation = $this->tokens->find($rawToken);

        if ($invitation === null) {
            return ['status' => 'not_found'];
        }

        if (
            $invitation->status === InvitationStatus::Pending
            && $invitation->expires_at->isPast()
        ) {
            DB::transaction(fn () => $this->markExpired($invitation));

            return ['status' => InvitationStatus::Expired->value];
        }

        if ($invitation->status !== InvitationStatus::Pending) {
            return ['status' => $invitation->status->value];
        }

        $invitation->load(['organization', 'invitedBy']);
        $organization = $invitation->organization;
        $inviter = $invitation->invitedBy;

        return [
            'status' => InvitationStatus::Pending->value,
            'email' => $invitation->email,
            'role' => $invitation->role->value,
            'expires_at' => $invitation->expires_at->toIso8601String(),
            'organization' => $organization === null ? null : [
                'id' => $organization->id,
                'slug' => $organization->slug,
                'name' => $organization->name,
            ],
            // Name-only — the inviter's email is a privacy leak on the
            // public preview (per spec 05 §3.7).
            'invited_by' => $inviter instanceof User ? ['name' => $inviter->name] : null,
        ];
    }

    // ── Internals ────────────────────────────────────────────────────

    private function normaliseEmail(string $email): string
    {
        return Str::lower(trim($email));
    }

    /**
     * Reject revoked / expired / email-mismatch. `accepted` is handled
     * by the caller for idempotency.
     */
    private function guardAcceptable(Invitation $invitation, User $acceptor): void
    {
        if ($invitation->status === InvitationStatus::Revoked) {
            throw new InvitationRevokedException;
        }

        if (
            $invitation->status === InvitationStatus::Expired
            || ($invitation->status === InvitationStatus::Pending && $invitation->expires_at->isPast())
        ) {
            throw new InvitationExpiredException;
        }

        if (Str::lower(trim($acceptor->email)) !== $invitation->email) {
            throw new InvitationEmailMismatchException;
        }
    }

    private function markExpired(Invitation $invitation): void
    {
        $invitation->status = InvitationStatus::Expired;
        $invitation->save();
    }

    /**
     * Promote a stale `pending` (expires_at < now()) to `expired` in
     * its OWN transaction so the new state persists even if a caller
     * subsequently rolls back its own transaction. Idempotent: a row
     * already in any non-pending state is a silent no-op.
     */
    private function maybePromoteExpired(string $rawToken): void
    {
        $invitation = $this->tokens->find($rawToken);
        if (
            $invitation === null
            || $invitation->status !== InvitationStatus::Pending
            || $invitation->expires_at->isFuture()
        ) {
            return;
        }

        DB::transaction(function () use ($invitation): void {
            /** @var Invitation $locked */
            $locked = Invitation::query()
                ->whereKey($invitation->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Re-check after the lock — another caller may have just
            // promoted this row.
            if ($locked->status !== InvitationStatus::Pending) {
                return;
            }

            if ($locked->expires_at->isFuture()) {
                return;
            }

            $this->markExpired($locked);
        });
    }

    private function existingActiveMembership(Invitation $invitation, User $acceptor): Membership
    {
        /** @var Membership $existing */
        $existing = Membership::query()
            ->where('organization_id', $invitation->organization_id)
            ->where('user_id', $acceptor->id)
            ->whereNull('deleted_at')
            ->firstOrFail();

        return $existing;
    }

    /**
     * Inlined from {@see MembershipService::add()} so the accept
     * transaction stays self-contained and lone-owner semantics (which
     * do not apply here) do not leak across services.
     */
    private function upsertMembership(Invitation $invitation, User $acceptor): Membership
    {
        $existing = Membership::withTrashed()
            ->where('organization_id', $invitation->organization_id)
            ->where('user_id', $acceptor->id)
            ->lockForUpdate()
            ->first();

        if ($existing !== null && ! $existing->trashed()) {
            // Already a member via another path — preserve their role.
            return $existing;
        }

        if ($existing !== null) {
            $existing->deleted_at = null;
            $existing->role = $invitation->role;
            $existing->joined_at = Carbon::now();
            $existing->save();

            return $existing->refresh();
        }

        return Membership::create([
            'organization_id' => $invitation->organization_id,
            'user_id' => $acceptor->id,
            'role' => $invitation->role->value,
            'joined_at' => Carbon::now(),
        ]);
    }

    /** @throws InvitationAlreadyMemberException */
    private function guardAlreadyMember(Organization $organization, string $email): void
    {
        $isMember = Membership::query()
            ->where('organization_id', $organization->id)
            ->whereNull('deleted_at')
            ->whereHas('user', function ($q) use ($email): void {
                $q->whereRaw('LOWER(email) = ?', [$email])->whereNull('deleted_at');
            })
            ->exists();

        if ($isMember) {
            throw new InvitationAlreadyMemberException;
        }
    }

    /**
     * Mirrors the partial unique index from the migration:
     * `(organization_id, LOWER(email)) WHERE status='pending' AND deleted_at IS NULL`.
     *
     * @throws InvitationAlreadyPendingException
     */
    private function guardAlreadyPending(Organization $organization, string $email): void
    {
        $hasPending = Invitation::query()
            ->where('organization_id', $organization->id)
            ->where('status', InvitationStatus::Pending->value)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('deleted_at')
            ->exists();

        if ($hasPending) {
            throw new InvitationAlreadyPendingException;
        }
    }

    /**
     * Reject a resend that lands inside the per-invitation cooldown
     * window — follow-up R1. Called on the lock-held `$fresh` row so two
     * parallel resends cannot both read a stale `last_resent_at`.
     *
     * @throws InvitationRateLimitException
     */
    private function guardResendCooldown(Invitation $invitation): void
    {
        $lastResentAt = $invitation->last_resent_at;

        // Version-agnostic: avoid diffInSeconds() whose sign differs
        // between Carbon 2 and 3. "cooldown still active" === the moment
        // the window closes is still in the future.
        if (
            $lastResentAt !== null
            && $lastResentAt->copy()->addSeconds(self::RESEND_COOLDOWN_SECONDS)->isFuture()
        ) {
            throw new InvitationRateLimitException;
        }
    }

    /** @throws InvitationRateLimitException */
    private function guardRateLimit(Organization $organization): void
    {
        // Serialise issuance per-org so two parallel invite()/resend()
        // transactions cannot both read the same sub-limit COUNT and both
        // insert past it — follow-up R2. Locking the org ROW (not the
        // invitations table) keeps this portable: on Postgres this emits
        // `SELECT ... FOR UPDATE`, holding concurrent same-org txns at the
        // COUNT below until we commit; on SQLite `lockForUpdate()` is an
        // inoffensive no-op and writes are already globally serialised, so
        // the race cannot occur there. (No advisory lock / LOCK TABLE —
        // both would break the SQLite test suite.)
        Organization::whereKey($organization->id)->lockForUpdate()->first();

        $since = Carbon::now()->subHours(self::RATE_LIMIT_WINDOW_HOURS);

        $count = Invitation::query()
            ->where('organization_id', $organization->id)
            ->where('created_at', '>=', $since)
            ->count();

        if ($count >= self::RATE_LIMIT_MAX) {
            throw new InvitationRateLimitException;
        }
    }

    /**
     * Queue the invitation email and defer the dispatch until AFTER the
     * surrounding transaction commits — follow-up R11. Previously this sent
     * synchronously inside `DB::transaction()`, so a slow/failing SMTP host
     * held the row lock for the whole send and a delivery error rolled back
     * an already-decided state change.
     *
     * `InvitationMail` is `ShouldQueue`, and `->afterCommit()` holds the job
     * dispatch until the transaction is durably committed: the invitation
     * row persists first, then the mail job is enqueued. A later mail
     * failure no longer undoes the invitation — the job retries and, if it
     * keeps failing, lands in `failed_jobs`. Requires a running queue worker
     * (`php artisan queue:work`; `composer dev` already runs `queue:listen`).
     */
    private function dispatchInvitationMail(Invitation $invitation, string $rawToken): void
    {
        Mail::to($invitation->email)->queue(
            (new InvitationMail($invitation, $rawToken))->afterCommit(),
        );
    }
}
