<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\MeController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')
    ->middleware(['supabase.auth', 'throttle:60,1'])
    ->group(function (): void {
        Route::get('/me', MeController::class)->name('v1.me');
    });
