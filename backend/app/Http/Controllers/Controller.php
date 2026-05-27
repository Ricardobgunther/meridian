<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Base controller for the application.
 *
 * Laravel 11 ships an empty abstract here by default; we mix in
 * `AuthorizesRequests` so `$this->authorize('verb', $model)` works
 * uniformly across every API controller, matching the pattern used in
 * `.ai/skills/api-security.md`.
 */
abstract class Controller
{
    use AuthorizesRequests;
}
