<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Row Level Security for users / organizations / memberships.
 *
 * Why these policies matter even though the Laravel API uses
 * service_role and therefore bypasses RLS:
 *
 *   - Supabase Realtime channels run as the authenticated user; they
 *     honour RLS to filter out rows the user shouldn't see.
 *   - Supabase Edge Functions and the dashboard SQL editor may run
 *     queries against these tables as the anon or authenticated role.
 *   - A misconfigured client that ever talks directly to Postgres
 *     with the anon key must still be locked down by RLS.
 *
 * ----------------------------------------------------------------------
 * FORCE ROW LEVEL SECURITY — why we use it
 * ----------------------------------------------------------------------
 * Plain `ENABLE ROW LEVEL SECURITY` exempts the table owner from its
 * own policies (Postgres docs: "Table owners normally bypass row
 * security, though a table owner can choose to be subject to row
 * security with ALTER TABLE ... FORCE ROW LEVEL SECURITY"). In a
 * Supabase project the role that ran this migration — and very
 * frequently the role the Laravel API connects with — owns these
 * tables, so without FORCE the policies are silently bypassed by the
 * most privileged callers. The dashboard SQL editor, a misconfigured
 * worker, or a future contributor connecting as the owner role would
 * all see unfiltered rows.
 *
 * `ALTER TABLE ... FORCE ROW LEVEL SECURITY` subjects the owner to
 * the same policies as anyone else, so RLS is *actually* enforced.
 *
 * Note for future maintainers: once FORCE is on, if you ever need a
 * one-off owner-as-superuser query (e.g. a backfill or maintenance
 * task) you must either (a) connect with a separate non-owner role
 * that has the privileges you need, (b) run `SET LOCAL row_security
 * = on;` and remain bound by the policies, or (c) use the Supabase
 * `service_role` (which is `BYPASSRLS`) for the duration of the
 * maintenance work.
 *
 * SQLite (used in CI) has no RLS concept — this migration becomes a
 * no-op on that driver.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        // -- users -----------------------------------------------------
        DB::statement('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE users FORCE ROW LEVEL SECURITY');
        DB::statement(<<<'SQL'
            CREATE POLICY users_select_self ON users
              FOR SELECT TO authenticated
              USING (
                id = auth.uid()
                AND deleted_at IS NULL
              )
        SQL);

        // -- organizations --------------------------------------------
        DB::statement('ALTER TABLE organizations ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE organizations FORCE ROW LEVEL SECURITY');
        DB::statement(<<<'SQL'
            CREATE POLICY organizations_select_member ON organizations
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL
                AND id IN (
                  SELECT organization_id
                  FROM memberships
                  WHERE user_id = auth.uid()
                    AND deleted_at IS NULL
                )
              )
        SQL);

        // -- memberships ----------------------------------------------
        DB::statement('ALTER TABLE memberships ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE memberships FORCE ROW LEVEL SECURITY');
        DB::statement(<<<'SQL'
            CREATE POLICY memberships_select_self ON memberships
              FOR SELECT TO authenticated
              USING (
                user_id = auth.uid()
                AND deleted_at IS NULL
              )
        SQL);
        // The outer `deleted_at IS NULL` is critical — without it,
        // co-members can enumerate who *used* to be in the org (PII
        // leak: the identity of past peers).
        DB::statement(<<<'SQL'
            CREATE POLICY memberships_select_co_members ON memberships
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL
                AND organization_id IN (
                  SELECT organization_id
                  FROM memberships
                  WHERE user_id = auth.uid()
                    AND deleted_at IS NULL
                )
              )
        SQL);
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        // DISABLE ROW LEVEL SECURITY implicitly clears the FORCE flag
        // applied in up(), so one DISABLE per table is enough to undo
        // both ENABLE and FORCE.
        DB::statement('DROP POLICY IF EXISTS memberships_select_co_members ON memberships');
        DB::statement('DROP POLICY IF EXISTS memberships_select_self ON memberships');
        DB::statement('ALTER TABLE memberships DISABLE ROW LEVEL SECURITY');

        DB::statement('DROP POLICY IF EXISTS organizations_select_member ON organizations');
        DB::statement('ALTER TABLE organizations DISABLE ROW LEVEL SECURITY');

        DB::statement('DROP POLICY IF EXISTS users_select_self ON users');
        DB::statement('ALTER TABLE users DISABLE ROW LEVEL SECURITY');
    }
};
