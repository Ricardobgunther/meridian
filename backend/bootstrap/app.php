<?php

use App\Exceptions\Domain\LoneOwnerException;
use App\Http\Middleware\ResolveOrganization;
use App\Http\Middleware\VerifySupabaseToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'supabase.auth' => VerifySupabaseToken::class,
            'org.resolve' => ResolveOrganization::class,
        ]);

        // Trusted proxies — env-driven because this is a reusable starter
        // template: the real proxy/LB range is deploy-specific, so we never
        // hardcode a CIDR here. Without this, behind Nginx/a load balancer
        // $request->ip() resolves to the *proxy* IP, collapsing every per-IP
        // throttle (throttle:60,1 and the accept_invitation 10/min limiter)
        // into a single shared bucket → weakened limits + false 429s.
        //
        // TRUSTED_PROXIES values:
        //   - empty/null → trust no proxy (SAFE DEFAULT; preserves current
        //     behavior, ip() reflects the direct connection).
        //   - '*'        → trust any proxy. Only safe when the app is solely
        //     reachable through a single known LB that is the only ingress;
        //     otherwise it lets clients spoof X-Forwarded-For and forge their IP.
        //     When using '*', ideally restrict the trusted headers to the bare
        //     minimum (e.g. only HEADER_X_FORWARDED_FOR) to reduce the
        //     Host/Proto spoofing surface.
        //   - CSV of CIDRs → trust only those ranges (e.g. "10.0.0.0/8,172.16.0.0/12").
        //     Surrounding whitespace is trimmed and empty entries (trailing
        //     comma) are dropped so a hand-typed CSV parses safely.
        $trustedProxies = env('TRUSTED_PROXIES');
        $middleware->trustProxies(
            at: $trustedProxies === '*'
                ? '*'
                : (filled($trustedProxies)
                    ? array_values(array_filter(array_map('trim', explode(',', $trustedProxies)), 'strlen'))
                    : null),
            // Standard forwarded headers repassed by Nginx. For AWS ELB use
            // Request::HEADER_X_FORWARDED_AWS_ELB instead of the FOR/HOST/PORT/PROTO set.
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Domain rule violations: lone owner cannot be removed/demoted.
        // 422 mirrors validation errors — the request was well-formed
        // but violated a business invariant.
        $exceptions->render(function (LoneOwnerException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(
                    ['error' => $e->getMessage()],
                    Response::HTTP_UNPROCESSABLE_ENTITY,
                );
            }

            return null;
        });
    })->create();
