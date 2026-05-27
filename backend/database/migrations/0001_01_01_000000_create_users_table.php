<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Local mirror of Supabase auth users.
 *
 * Per ADR-011, `users.id` is a UUID that mirrors the Supabase JWT `sub`
 * claim (`auth.uid()`). The row is upserted lazily on the first
 * authenticated request — there is no password column because Supabase
 * is the single source of truth for credentials.
 *
 * The `sessions` table is kept (harmless) because Laravel internals may
 * still reference it; we no longer use Laravel session auth.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            // UUID PK — application generates it (Str::uuid() / HasUuids).
            // We intentionally do NOT use gen_random_uuid() as a column
            // default because the value must equal the Supabase JWT sub,
            // and SQLite (used in CI tests) has no such function.
            $table->uuid('id')->primary();

            $table->string('email')->unique();
            $table->string('name')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('locale', 10)->default('pt-BR');
            $table->string('timezone', 50)->default('America/Sao_Paulo');
            $table->timestampTz('last_seen_at')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Partial index on active users (Postgres only — SQLite doesn't
        // support partial indexes via Blueprint, and the table is small
        // enough in tests that a full index is unnecessary there).
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            \DB::statement('CREATE INDEX idx_users_active ON users (email) WHERE deleted_at IS NULL');
        }

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            // user_id is a UUID FK now (string column to match users.id).
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            \DB::statement('DROP INDEX IF EXISTS idx_users_active');
        }

        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
    }
};
