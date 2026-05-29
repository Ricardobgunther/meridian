<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Row Level Security for `invitations` — ADR-013.
 *
 * Mirror of `2026_05_26_000003_enable_rls_policies.php` (read its header
 * for the full rationale on FORCE ROW LEVEL SECURITY and why the
 * Laravel API still benefits from these policies despite using
 * service_role). This file isolates the invitations policies in their
 * own migration so the table can be reasoned about independently.
 *
 * Threat model in one paragraph:
 *   - The invitation *recipient* never authenticates against the API
 *     using the org's identity until *after* accept. They reach the
 *     accept-flow via a public endpoint that takes the raw token,
 *     hashes it, and looks the invite up server-side via the Laravel
 *     service_role connection — NOT via RLS. So we do not need (and
 *     deliberately do not write) a policy that grants the invitee
 *     access through `auth.uid()`.
 *   - The org-side actors (owners/admins) read/write invitations via
 *     the Laravel API. The policies below cover the realtime/dashboard
 *     paths where requests run as `authenticated`.
 *
 * Policies are dropped with IF EXISTS so re-running the migration in
 * dev is idempotent.
 *
 * SQLite (used in CI) has no RLS concept — this migration is a no-op
 * on that driver, matching the pattern in the prior RLS migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE invitations ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE invitations FORCE ROW LEVEL SECURITY');

        // Drop first so re-runs are safe (the CREATE POLICY DDL has no
        // IF NOT EXISTS variant in older Postgres versions Supabase still
        // ships).
        DB::statement('DROP POLICY IF EXISTS invitations_select_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_insert_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_update_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_delete_admins ON invitations');

        // The recurring subquery: "is the current user an active
        // owner/admin of the invitation's organization?". The outer
        // `deleted_at IS NULL` on memberships matches the pattern used
        // for `memberships_select_co_members` — without it we'd leak
        // access to former admins.
        $isOrgAdminSql = <<<'SQL'
            organization_id IN (
              SELECT organization_id
              FROM memberships
              WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
                AND deleted_at IS NULL
            )
        SQL;

        // SELECT: owners and admins of the org see its invitations.
        // Soft-deleted rows are hidden — the Laravel `service_role`
        // connection can still read them when needed (BYPASSRLS).
        DB::statement(<<<SQL
            CREATE POLICY invitations_select_admins ON invitations
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL
                AND $isOrgAdminSql
              )
        SQL);

        // INSERT: owners/admins can create invitations for their org.
        // We only validate the org link here; the FormRequest layer
        // owns role/email validation.
        DB::statement(<<<SQL
            CREATE POLICY invitations_insert_admins ON invitations
              FOR INSERT TO authenticated
              WITH CHECK (
                $isOrgAdminSql
              )
        SQL);

        // UPDATE: owners/admins may revoke or otherwise edit invites
        // belonging to their org. USING gates which rows they can see
        // to update; WITH CHECK prevents re-homing a row to another org.
        DB::statement(<<<SQL
            CREATE POLICY invitations_update_admins ON invitations
              FOR UPDATE TO authenticated
              USING (
                $isOrgAdminSql
              )
              WITH CHECK (
                $isOrgAdminSql
              )
        SQL);

        // DELETE: present for completeness, but the API performs soft
        // delete via UPDATE (deleted_at). We keep this policy so a
        // future admin tool / dashboard query that issues a hard DELETE
        // remains tenant-scoped rather than silently failing open.
        DB::statement(<<<SQL
            CREATE POLICY invitations_delete_admins ON invitations
              FOR DELETE TO authenticated
              USING (
                $isOrgAdminSql
              )
        SQL);
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP POLICY IF EXISTS invitations_delete_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_update_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_insert_admins ON invitations');
        DB::statement('DROP POLICY IF EXISTS invitations_select_admins ON invitations');

        // DISABLE implicitly clears FORCE as well.
        DB::statement('ALTER TABLE invitations DISABLE ROW LEVEL SECURITY');
    }
};
