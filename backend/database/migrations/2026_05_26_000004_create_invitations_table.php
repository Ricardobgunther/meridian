<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Invitations — email-based join requests into an Organization (ADR-008, ADR-013).
 *
 * One row represents "User X invited <email> to join <org> as <role>".
 *
 * Design highlights (full reasoning in ADR-013):
 *  - `token_hash` stores a SHA-256 of the invitation token; the raw token
 *    only lives in the invitation email. A leak of this table cannot be
 *    used to accept invitations.
 *  - `expires_at` is NOT NULL — every invite has a hard TTL. The service
 *    layer defaults to now()+7d; a future scheduled job will sweep
 *    expired rows to `status = 'expired'`.
 *  - `status` is a string enum (`pending` | `accepted` | `revoked` |
 *    `expired`). Pgsql enforces it with CHECK; sqlite relies on the
 *    application layer (matches the membership pattern).
 *  - `role` is restricted to `member` | `admin`. `owner` is intentionally
 *    NOT inviteable — ownership transfer is a separate, deliberate flow
 *    (out of scope for this block).
 *  - Email is normalised to lowercase at the service layer; we index on
 *    `LOWER(email)` so case-insensitive lookups stay sargable on both
 *    Postgres and SQLite without requiring the `citext` extension.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            // UUID PK — application-generated via HasUuids on the model
            // (no DB-side default, matching users/organizations/memberships
            // so the migration works identically on sqlite).
            $table->uuid('id')->primary();

            $table->uuid('organization_id');

            // Email stored as plain string; the service layer is
            // responsible for `Str::lower(trim($email))` before insert.
            // We deliberately do NOT use Postgres `citext` here: it would
            // require enabling an extension that SQLite cannot mirror,
            // and the lowercase invariant is cheap to enforce in PHP.
            // The expression index below makes `LOWER(email)` lookups
            // index-served on both drivers.
            $table->string('email', 255);

            // Role: `member` or `admin` only. `owner` is intentionally
            // omitted — see ADR-013 and the FormRequest enforcement on
            // the API side.
            $table->string('role', 20);

            // SHA-256 hex digest of the raw invitation token — always
            // exactly 64 hex chars. UNIQUE so a token collision (or
            // replay) is impossible.
            $table->string('token_hash', 64)->unique('uniq_invitations_token_hash');

            // Expiry is mandatory — every invite must die eventually.
            $table->timestampTz('expires_at');

            // Lifecycle enum: pending → accepted | revoked | expired.
            $table->string('status', 20)->default('pending');

            // Audit: who issued the invite and who accepted it.
            // SET NULL on user deletion so the invite history survives
            // a user being removed (matches the soft-delete philosophy
            // in ADR-005).
            $table->uuid('invited_by_user_id')->nullable();
            $table->uuid('accepted_by_user_id')->nullable();

            $table->timestampTz('accepted_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();

            // ── Foreign keys ──────────────────────────────────────────
            // Cascade on org delete: if the tenant root is hard-removed,
            // its outstanding invites have no meaning.
            $table->foreign('organization_id')
                ->references('id')->on('organizations')
                ->cascadeOnDelete();

            $table->foreign('invited_by_user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->foreign('accepted_by_user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            // ── Indexes ──────────────────────────────────────────────
            // FK indexes (Postgres does not auto-index FKs).
            $table->index('organization_id', 'idx_invitations_organization_id');
            $table->index('invited_by_user_id', 'idx_invitations_invited_by_user_id');
            $table->index('accepted_by_user_id', 'idx_invitations_accepted_by_user_id');

            // List "all invitations for org X with status Y" — the
            // primary listing query from the admin UI.
            $table->index(['organization_id', 'status'], 'idx_invitations_org_status');

            // Drives the future "expire stale invites" scheduled job.
            $table->index('expires_at', 'idx_invitations_expires_at');
        });

        // ── Partial unique index on (organization_id, LOWER(email)) ─
        // Prevents two concurrent *pending* invites for the same email
        // in the same org. Once an invite is accepted/revoked/expired
        // (or soft-deleted) a new one can be issued. Both Postgres
        // and SQLite >= 3.8 accept this syntax.
        DB::statement(
            'CREATE UNIQUE INDEX uniq_invitations_org_email_pending '
            .'ON invitations (organization_id, LOWER(email)) '
            ."WHERE status = 'pending' AND deleted_at IS NULL"
        );

        // ── Expression index for case-insensitive email lookups ─────
        // Supports "find pending invites for foo@example.com" without
        // forcing every query to do a sequential scan on LOWER().
        DB::statement(
            'CREATE INDEX idx_invitations_lower_email '
            .'ON invitations (LOWER(email))'
        );

        // ── Enum CHECK constraints (Postgres only) ──────────────────
        // SQLite is best-effort: Laravel's Blueprint doesn't expose
        // CHECK constraints portably, and the application validates
        // these values on insert. Matches the memberships pattern.
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement(
                "ALTER TABLE invitations ADD CONSTRAINT chk_invitations_role "
                ."CHECK (role IN ('member', 'admin'))"
            );
            DB::statement(
                "ALTER TABLE invitations ADD CONSTRAINT chk_invitations_status "
                ."CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))"
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE invitations DROP CONSTRAINT IF EXISTS chk_invitations_status');
            DB::statement('ALTER TABLE invitations DROP CONSTRAINT IF EXISTS chk_invitations_role');
        }

        DB::statement('DROP INDEX IF EXISTS idx_invitations_lower_email');
        DB::statement('DROP INDEX IF EXISTS uniq_invitations_org_email_pending');

        Schema::dropIfExists('invitations');
    }
};
