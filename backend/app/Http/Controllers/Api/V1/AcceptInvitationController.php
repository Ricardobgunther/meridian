<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Models\User;
use App\Services\InvitationService;
use App\Services\InvitationTokenIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP entry point for the accept-by-token flow:
 *   - `show`    GET    /api/v1/invitations/accept            (public)
 *   - `store`   POST   /api/v1/invitations/accept            (auth required)
 *   - `destroy` POST   /api/v1/invitations/accept/decline    (auth required)
 *
 * The token travels in the `X-Invitation-Token` HEADER, never in the URL
 * path (follow-up R10). A path-param is a bearer credential captured by
 * every access log / APM by default; a header is not. The frontend
 * `/invite/<token>` page still carries the token in its own path (it is
 * the link the user clicks) — that surface is covered by the
 * `Referrer-Policy: no-referrer` header set on that route.
 *
 * Why these are NOT under `org.resolve`: the invitee has no org context
 * to send a header for — the token IS the org scope. The service
 * looks the row up by `token_hash` directly.
 *
 * Why the GET is public: the accept page must render the right card
 * (valid / expired / revoked / not-found) before the user logs in. The
 * preview returns a discriminated payload so the page can branch without
 * leaking sensitive details (no inviter email, no org id for revoked
 * rows etc. — see {@see InvitationService::previewByToken()}).
 *
 * Token shape: 43 chars of base64url (alphanumeric, `-`, `_`). We
 * sanity-check the alphabet here — a header that fails the regex (or is
 * missing) obviously cannot match a real hash, so we 200 with `not_found`
 * (preview) / 404 (accept) / 204 (decline) without even hashing.
 */
class AcceptInvitationController extends Controller
{
    private const TOKEN_HEADER = 'X-Invitation-Token';

    /**
     * Regex matching the base64url alphabet used by
     * {@see InvitationTokenIssuer::generate()} — 32 raw bytes
     * encoded as 43 chars in practice. We accept a wider 32-128 band as
     * defence in depth and short-circuit with `not_found` before any hash +
     * DB lookup. The shape check is tested in `AcceptInvitationApiTest.php`.
     */
    private const TOKEN_PATTERN = '/^[A-Za-z0-9_-]{32,128}$/';

    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    /**
     * GET /api/v1/invitations/accept — public preview.
     *
     * Token comes from the `X-Invitation-Token` header. Always 200; the
     * discriminated `status` field tells the client which card to render.
     * This flat surface prevents token enumeration via a response-code
     * side-channel. `Cache-Control: no-store` is mandatory: the path is now
     * static, so a cache keyed on URL alone would cross-serve one token's
     * preview to another request.
     */
    public function show(Request $request): JsonResponse
    {
        $token = $this->tokenFromHeader($request);
        if ($token === null) {
            return $this->noStore(response()->json(['data' => ['status' => 'not_found']]));
        }

        $payload = $this->invitations->previewByToken($token);

        return $this->noStore(response()->json(['data' => $payload]));
    }

    /**
     * POST /api/v1/invitations/accept — consume the token.
     *
     * Auth required; token from the `X-Invitation-Token` header. The service
     * performs the email-match check against the authenticated user;
     * mismatch surfaces as 403 with code `invitation_email_mismatch`.
     * Returns 200 with the new membership + minimal organization payload so
     * the client can navigate to the new org's home without an extra
     * round-trip.
     */
    public function store(Request $request): JsonResponse
    {
        $token = $this->tokenFromHeader($request);
        if ($token === null) {
            return response()->json(
                ['error' => 'Convite não encontrado.', 'code' => 'invitation_not_found'],
                Response::HTTP_NOT_FOUND,
            );
        }

        /** @var User $user */
        $user = $request->user();

        $membership = $this->invitations->accept($token, $user);
        $membership->load(['user', 'organization']);

        $organization = $membership->organization;

        return response()->json([
            'data' => [
                'membership' => (new MembershipResource($membership))->toArray($request),
                'organization' => $organization === null ? null : [
                    'id' => $organization->id,
                    'slug' => $organization->slug,
                    'name' => $organization->name,
                ],
                'role' => $membership->role->value,
            ],
        ]);
    }

    /**
     * POST /api/v1/invitations/accept/decline — refuse the invite. Token
     * from the `X-Invitation-Token` header. Marks the row as `revoked` and
     * is idempotent.
     */
    public function destroy(Request $request): Response
    {
        $token = $this->tokenFromHeader($request);
        if ($token === null) {
            // Idempotent on the public side: a malformed/missing token
            // always 204 for decline (vs 404 on accept) — there is nothing
            // to confirm, and the UX path is "you tried to decline, we
            // pretended it worked". Avoids exposing whether a token ever
            // existed.
            return response()->noContent();
        }

        /** @var User $user */
        $user = $request->user();

        $this->invitations->decline($token, $user);

        return response()->noContent();
    }

    /**
     * The validated raw token from the `X-Invitation-Token` header, or null
     * when the header is absent or fails the shape check.
     */
    private function tokenFromHeader(Request $request): ?string
    {
        $token = $request->header(self::TOKEN_HEADER);

        return is_string($token) && preg_match(self::TOKEN_PATTERN, $token) === 1
            ? $token
            : null;
    }

    private function noStore(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'no-store');
    }
}
