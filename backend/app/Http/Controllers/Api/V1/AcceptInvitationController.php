<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP entry point for the accept-by-token flow:
 *   - `show`    GET    /api/v1/invitations/accept/{token}            (public)
 *   - `store`   POST   /api/v1/invitations/accept/{token}            (auth required)
 *   - `destroy` POST   /api/v1/invitations/accept/{token}/decline    (auth required)
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
 * Path-parameter token shape: 43 chars of base64url (alphanumeric, `-`,
 * `_`). We sanity-check the alphabet at the controller level — anything
 * that fails this regex obviously cannot match a real hash so we 200
 * with `not_found` (preview) / 404 (POST), without even hashing.
 */
class AcceptInvitationController extends Controller
{
    /**
     * Regex matching the base64url alphabet used by
     * {@see InvitationService::generateRawToken()} — 32 raw bytes encoded
     * as 43 chars in practice. We accept a wider 32-128 band as defence
     * in depth: the route-level `where()` is the first gate (rejects
     * <16 chars at the router); this controller-level check is a tighter
     * second gate that catches 16-31-char inputs and short-circuits with
     * `not_found` before any hash + DB lookup. The asymmetry is tested in
     * `AcceptInvitationApiTest.php`.
     */
    private const TOKEN_PATTERN = '/^[A-Za-z0-9_-]{32,128}$/';

    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    /**
     * GET /api/v1/invitations/accept/{token} — public preview.
     *
     * Always 200 (or 4xx for malformed tokens). The discriminated `status`
     * field tells the client which card to render. This flat surface
     * prevents token enumeration via response-code-side-channel.
     */
    public function show(string $token): JsonResponse
    {
        if (! $this->isTokenShapeValid($token)) {
            return response()->json(['data' => ['status' => 'not_found']]);
        }

        $payload = $this->invitations->previewByToken($token);

        return response()->json(['data' => $payload]);
    }

    /**
     * POST /api/v1/invitations/accept/{token} — consume the token.
     *
     * Auth required. The service performs the email-match check against
     * the authenticated user; mismatch surfaces as 403 with code
     * `invitation_email_mismatch`. Returns 200 with the new membership +
     * minimal organization payload so the client can navigate to the
     * new org's home without an extra round-trip.
     */
    public function store(Request $request, string $token): JsonResponse
    {
        if (! $this->isTokenShapeValid($token)) {
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
     * POST /api/v1/invitations/accept/{token}/decline — refuse the
     * invite. Marks the row as `revoked` and is idempotent.
     */
    public function destroy(Request $request, string $token): Response
    {
        if (! $this->isTokenShapeValid($token)) {
            // Idempotent on the public side: malformed tokens always 204
            // for decline (vs 404 on accept) — there is nothing to
            // confirm, and the UX path is "you tried to decline, we
            // pretended it worked". Avoids exposing whether a malformed
            // token ever existed.
            return response()->noContent();
        }

        /** @var User $user */
        $user = $request->user();

        $this->invitations->decline($token, $user);

        return response()->noContent();
    }

    private function isTokenShapeValid(string $token): bool
    {
        return preg_match(self::TOKEN_PATTERN, $token) === 1;
    }
}
