<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;

/*
|--------------------------------------------------------------------------
| Trusted Proxies (R13) — parsing + forwarded semantics
|--------------------------------------------------------------------------
|
| bootstrap/app.php reads env('TRUSTED_PROXIES') ONCE, at application boot,
| BEFORE any Pest test body runs. Mutating the env inside a test does NOT
| re-run that bootstrap closure, so we cannot exercise the real boot branch
| by simply setting the env mid-test.
|
| Instead we cover the two places where the actual risk lives, without
| touching production code:
|
|   (a) PARSING — we reproduce the EXACT expression bootstrap/app.php uses to
|       turn the env string into a proxy list, then prove the resulting CIDRs
|       are valid (Symfony IpUtils::checkIp accepts them and matches the right
|       hosts). This directly covers the CSV-with-space case that the old
|       missing-trim bug broke.
|
|   (b) FORWARDED SEMANTICS — we build a real Illuminate Request carrying a
|       forged X-Forwarded-For and call Request::setTrustedProxies(...) with
|       the parsed list. This validates the observable behavior that
|       trustProxies() configures: a trusted proxy makes ip() reflect the real
|       client, while no trusted proxy makes the forged header be ignored.
|
| Request::setTrustedProxies() is global/static state, so each test restores
| the empty default in an afterEach to avoid leaking trust between tests.
|
*/

/**
 * Mirror of the parsing expression in bootstrap/app.php. Kept in sync by hand
 * on purpose: extracting it into shared production code is out of scope for a
 * test-only change, so we re-derive the same array the boot closure would.
 *
 * @return string|array<int, string>|null
 */
function parseTrustedProxies(?string $env): string|array|null
{
    return $env === '*'
        ? '*'
        : (filled($env)
            ? array_values(array_filter(array_map('trim', explode(',', $env)), 'strlen'))
            : null);
}

afterEach(function (): void {
    // setTrustedProxies is static/global; reset so trust never leaks forward.
    Request::setTrustedProxies([], Request::HEADER_X_FORWARDED_FOR);
});

describe('TRUSTED_PROXIES env parsing', function (): void {
    it('maps the wildcard to the literal star (trust any proxy)', function (): void {
        expect(parseTrustedProxies('*'))->toBe('*');
    });

    it('maps empty/null env to null so no proxy is trusted by default', function (): void {
        expect(parseTrustedProxies(null))->toBeNull();
        expect(parseTrustedProxies(''))->toBeNull();
    });

    it('parses a single CIDR into a one-element list', function (): void {
        expect(parseTrustedProxies('10.0.0.0/8'))->toBe(['10.0.0.0/8']);
    });

    it('trims surrounding whitespace so a hand-typed CSV parses into valid CIDRs', function (): void {
        // This is the exact input the old missing-trim bug mangled: the second
        // entry arrived as " 172.16.0.0/12" (leading space) and matched nothing.
        $proxies = parseTrustedProxies('10.0.0.0/8, 172.16.0.0/12');

        expect($proxies)->toBe(['10.0.0.0/8', '172.16.0.0/12']);

        // Prove both ranges are genuinely valid CIDRs Symfony can match against,
        // i.e. no stray whitespace survived to break IpUtils.
        expect(IpUtils::checkIp('10.1.2.3', $proxies))->toBeTrue();
        expect(IpUtils::checkIp('172.16.5.4', $proxies))->toBeTrue();
        expect(IpUtils::checkIp('192.168.0.1', $proxies))->toBeFalse();
    });

    it('drops empty entries from a trailing comma instead of producing a blank range', function (): void {
        expect(parseTrustedProxies('10.0.0.0/8,'))->toBe(['10.0.0.0/8']);
        expect(parseTrustedProxies('10.0.0.0/8, ,172.16.0.0/12'))
            ->toBe(['10.0.0.0/8', '172.16.0.0/12']);
    });
});

describe('forwarded-IP semantics under each trust configuration', function (): void {
    it('reflects the real client IP when the connecting proxy is trusted', function (): void {
        // Client 203.0.113.7 -> trusted proxy 10.0.0.5 -> app.
        $request = Request::create('/api/v1/me', 'GET', server: [
            'REMOTE_ADDR' => '10.0.0.5',
        ]);
        $request->headers->set('X-Forwarded-For', '203.0.113.7');

        Request::setTrustedProxies(
            parseTrustedProxies('10.0.0.0/8, 172.16.0.0/12'),
            Request::HEADER_X_FORWARDED_FOR,
        );

        expect($request->ip())->toBe('203.0.113.7');
    });

    it('trusts any connecting proxy when configured with the wildcard', function (): void {
        $request = Request::create('/api/v1/me', 'GET', server: [
            'REMOTE_ADDR' => '198.51.100.42',
        ]);
        $request->headers->set('X-Forwarded-For', '203.0.113.7');

        // Laravel's TrustProxies translates the '*' wildcard into "trust the
        // calling IP", i.e. setTrustedProxies([REMOTE_ADDR], ...). We reproduce
        // that exact translation rather than passing the bare '*' string, which
        // Symfony's setTrustedProxies() does not accept.
        Request::setTrustedProxies(
            [$request->server->get('REMOTE_ADDR')],
            Request::HEADER_X_FORWARDED_FOR,
        );

        expect($request->ip())->toBe('203.0.113.7');
    });

    it('ignores a forged X-Forwarded-For when no proxy is trusted (safe default)', function (): void {
        $request = Request::create('/api/v1/me', 'GET', server: [
            'REMOTE_ADDR' => '198.51.100.42',
        ]);
        // Attacker forges the header trying to spoof a different source IP.
        $request->headers->set('X-Forwarded-For', '203.0.113.7');

        // Default branch: env empty -> parseTrustedProxies(null) -> no trust.
        Request::setTrustedProxies([], Request::HEADER_X_FORWARDED_FOR);

        // ip() falls back to the direct connection; the forged header is ignored.
        expect($request->ip())->toBe('198.51.100.42');
    });
});
