<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-invitation resend cooldown support — follow-up R1.
 *
 * `resend()` mutates the existing row instead of inserting a new one, so
 * the org-wide issuance rate limit (which counts rows by `created_at`)
 * never trips on resends. An admin could otherwise re-send the SAME invite
 * unbounded times, spamming the recipient. This column records the last
 * resend so the service can enforce a short cooldown per invitation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->timestampTz('last_resent_at')->nullable()->after('revoked_at');
        });
    }

    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropColumn('last_resent_at');
        });
    }
};
