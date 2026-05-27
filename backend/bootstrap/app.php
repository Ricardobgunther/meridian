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
