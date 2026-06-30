<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Organizations — the tenant root (ADR-008).
 *
 * Every domain table will eventually carry an `organization_id` FK
 * referencing this table. The `slug` is the URL-friendly identifier
 * used in some links; `settings` is a free-form JSONB blob (text on
 * SQLite — Laravel handles the dialect mapping).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Slug uniqueness is enforced by a *partial* index below
            // (active rows only) so a soft-deleted org frees up its slug
            // for reuse. A plain `->unique()` would block that.
            $table->string('slug', 60);
            $table->string('name', 120);
            // jsonb on pgsql, text on sqlite — Laravel maps the dialect.
            $table->jsonb('settings')->default(json_encode(new \stdClass()));

            // created_by is a soft FK to users.id.
            // We constrain it but use restrictOnDelete so we never lose
            // the audit trail of who founded the org.
            $table->uuid('created_by');

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('created_by')
                ->references('id')->on('users')
                ->restrictOnDelete();

            // FK index (Postgres does not auto-index FKs).
            $table->index('created_by', 'idx_organizations_created_by');
            // deleted_at index for cheap "active orgs" listing.
            $table->index('deleted_at', 'idx_organizations_deleted_at');
        });

        // Partial unique index on slug — only active rows. Both Postgres
        // (>= 7.x) and SQLite (>= 3.8) accept the same syntax, so a
        // raw DDL statement is the most portable option here. Laravel's
        // schema builder doesn't expose partial indexes in a portable
        // way as of Laravel 11.
        DB::statement(
            'CREATE UNIQUE INDEX uniq_organizations_slug_active '
            .'ON organizations (slug) WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS uniq_organizations_slug_active');
        Schema::dropIfExists('organizations');
    }
};
