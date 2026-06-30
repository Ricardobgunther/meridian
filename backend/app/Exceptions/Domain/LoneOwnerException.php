<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use RuntimeException;

/**
 * Thrown when an operation would leave the organization without any
 * `owner` — the schema guarantees at least one owner exists for any
 * non-empty org (see ADR-010), and the API enforces that invariant by
 * rejecting destructive role changes/removals against the last owner.
 *
 * Rendered to HTTP 422 with a PT-BR message by the exception handler
 * registered in `bootstrap/app.php`.
 */
class LoneOwnerException extends RuntimeException
{
    public function __construct(string $message = 'Não é possível remover o último proprietário da organização. Promova outro membro a owner antes de continuar.')
    {
        parent::__construct($message);
    }
}
