<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Supabase Project URL
    |--------------------------------------------------------------------------
    |
    | The base URL of the Supabase project. Used for any REST / GoTrue calls
    | the backend may issue. Found in Project Settings > API.
    |
    */
    'url' => env('SUPABASE_URL'),

    /*
    |--------------------------------------------------------------------------
    | JWT Secret (HS256)
    |--------------------------------------------------------------------------
    |
    | Shared secret used by Supabase Auth to sign access tokens. The backend
    | uses it to verify incoming `Authorization: Bearer <token>` headers.
    | Found in Project Settings > API > JWT Settings. Must NEVER be exposed
    | to the frontend.
    |
    */
    'jwt_secret' => env('SUPABASE_JWT_SECRET'),
];
