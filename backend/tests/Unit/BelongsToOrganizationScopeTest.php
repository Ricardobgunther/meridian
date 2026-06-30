<?php

declare(strict_types=1);

use App\Models\Concerns\BelongsToOrganization;
use App\Models\Concerns\BelongsToOrganizationScope;
use Illuminate\Database\Eloquent\Model;

/*
|--------------------------------------------------------------------------
| BL-2 — tenant scope must throw in HTTP context, no-op in CLI.
|--------------------------------------------------------------------------
|
| The global scope is the only barrier between tenants on the HTTP path
| (the application connects via Supabase service_role which bypasses RLS).
| If `current_organization_id` is unbound — e.g. a route forgot the
| `org.resolve` middleware — the scope must refuse the query so the
| missing wiring surfaces as a hard error rather than a silent leak.
| Outside HTTP (jobs, console, model boot), the absence of the binding
| is legitimate and the scope is a no-op.
|
*/

uses(Tests\TestCase::class);

// The scope class lives in the same PHP file as the BelongsToOrganization
// trait (intentional, to keep the model file under the line limit), so
// referencing the trait first triggers Composer autoload for the file and
// makes the secondary class resolvable.
class_exists(BelongsToOrganization::class);

beforeEach(function (): void {
    app()->forgetInstance('current_organization_id');
    app()->forgetInstance('request');
});

it('throws in HTTP context when current_organization_id is not bound', function (): void {
    // Simulate an inbound HTTP request without org.resolve having run.
    app()->instance('request', \Illuminate\Http\Request::create('/api/v1/whatever'));

    $scope = new BelongsToOrganizationScope();
    $model = new class extends Model {
        protected $table = 'fake_tenant_table';
    };
    $builder = $model->newQuery();

    expect(fn () => $scope->apply($builder, $model))
        ->toThrow(RuntimeException::class, 'org.resolve');

    app()->forgetInstance('request');
});

it('is a no-op in CLI context when current_organization_id is not bound', function (): void {
    // No `request` instance bound — represents a queue worker, artisan
    // command, or any non-HTTP touchpoint.
    expect(app()->bound('request'))->toBeFalse();

    $scope = new BelongsToOrganizationScope();
    $model = new class extends Model {
        protected $table = 'fake_tenant_table';
    };
    $builder = $model->newQuery();

    $scope->apply($builder, $model);

    // Builder should be unchanged — no `where organization_id = ?` added.
    $sql = $builder->toSql();
    expect($sql)->not->toContain('organization_id');
});

it('applies the where clause when current_organization_id is bound', function (): void {
    app()->instance('current_organization_id', '00000000-0000-0000-0000-000000000001');

    $scope = new BelongsToOrganizationScope();
    $model = new class extends Model {
        protected $table = 'fake_tenant_table';
    };
    $builder = $model->newQuery();

    $scope->apply($builder, $model);

    expect($builder->toSql())->toContain('"organization_id" = ?');
});
