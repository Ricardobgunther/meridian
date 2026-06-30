<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Memberships — pivot between users and organizations (ADR-008, ADR-010).
 *
 * Roles are a fixed enum: owner | admin | member (ADR-010). A user can
 * belong to an organization at most once (unique constraint). A user
 * leaving an org is a hard delete here, but the orgs/users themselves
 * are soft-deleted elsewhere — so we keep `deleted_at` for symmetry and
 * the rare "audit who was once a member" query.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('memberships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('user_id');

            // Role: validated by CHECK on pgsql, defended in code on sqlite.
            $table->string('role', 20);

            // joined_at: NOW() at insert time. useCurrent() emits
            // DEFAULT CURRENT_TIMESTAMP, which both Postgres and SQLite
            // accept; on pgsql it resolves to a TIMESTAMPTZ thanks to
            // timestampTz().
            $table->timestampTz('joined_at')->useCurrent();

            $table->timestampsTz();
            $table->softDeletesTz();

            // FKs — cascade on delete to clean up memberships when
            // either side is hard-removed.
            $table->foreign('organization_id')
                ->references('id')->on('organizations')
                ->cascadeOnDelete();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            // A user belongs to an org at most once.
            $table->unique(['organization_id', 'user_id'], 'uniq_memberships_org_user');

            // FK indexes (Postgres needs them; harmless on SQLite).
            $table->index('organization_id', 'idx_memberships_organization_id');
            $table->index('user_id', 'idx_memberships_user_id');

            // Composite index optimised for "list my organizations".
            $table->index(['user_id', 'organization_id'], 'idx_memberships_user_org');
        });

        // Enforce the role enum on Postgres. SQLite is best-effort: it
        // accepts CHECK constraints but Laravel's Blueprint doesn't
        // surface them portably, so we only emit it on pgsql.
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            \DB::statement(
                "ALTER TABLE memberships ADD CONSTRAINT chk_memberships_role "
                ."CHECK (role IN ('owner', 'admin', 'member'))"
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            \DB::statement('ALTER TABLE memberships DROP CONSTRAINT IF EXISTS chk_memberships_role');
        }

        Schema::dropIfExists('memberships');
    }
};
