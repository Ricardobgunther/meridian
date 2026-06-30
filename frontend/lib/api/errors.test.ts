import { describe, expect, it } from 'vitest';

import { parseApiError, buildApiError } from './errors';
import type { ApiError } from '@/lib/types/api';

describe('parseApiError', () => {
  it('passes ApiError shape through with title for the code', () => {
    const err: ApiError = {
      status: 403,
      code: 'forbidden',
      message: 'Apenas administradores podem editar.',
    };
    const parsed = parseApiError(err);
    expect(parsed.title).toBe('Sem permissão');
    expect(parsed.message).toBe('Apenas administradores podem editar.');
    expect(parsed.code).toBe('forbidden');
  });

  it('flattens fieldErrors to first message per field', () => {
    const err: ApiError = {
      status: 422,
      code: 'validation',
      message: 'Os dados são inválidos.',
      fieldErrors: {
        name: ['Nome é obrigatório.', 'Outro erro.'],
        slug: ['Slug já em uso.'],
      },
    };
    const parsed = parseApiError(err);
    expect(parsed.title).toBe('Verifique os campos');
    expect(parsed.fieldErrors).toEqual({
      name: 'Nome é obrigatório.',
      slug: 'Slug já em uso.',
    });
  });

  it('maps TypeError to network failure', () => {
    const parsed = parseApiError(new TypeError('fetch failed'));
    expect(parsed.code).toBe('network');
    expect(parsed.title).toBe('Sem conexão');
    expect(parsed.message).toMatch(/internet/i);
  });

  it('maps DOMException AbortError to cancellation', () => {
    const parsed = parseApiError(new DOMException('aborted', 'AbortError'));
    expect(parsed.title).toBe('Cancelado');
  });

  it('falls back to generic message for unknown errors', () => {
    const parsed = parseApiError({ random: 'object' });
    expect(parsed.title).toBe('Algo deu errado');
    expect(parsed.message).toMatch(/Tente novamente/);
  });
});

describe('buildApiError', () => {
  it('builds 422 with field errors extracted from Laravel shape', async () => {
    const built = await buildApiError(422, {
      message: 'Os dados são inválidos.',
      errors: {
        name: ['Nome é obrigatório.'],
        slug: ['Slug inválido.'],
      },
    });
    expect(built.status).toBe(422);
    expect(built.code).toBe('validation');
    expect(built.fieldErrors).toEqual({
      name: ['Nome é obrigatório.'],
      slug: ['Slug inválido.'],
    });
    expect(built.message).toContain('Os dados');
  });

  it('uses friendly default message for 5xx', async () => {
    const built = await buildApiError(500, {});
    expect(built.code).toBe('server');
    expect(built.message).toMatch(/lado/i);
  });

  it('uses server message for 403 if provided', async () => {
    const built = await buildApiError(403, {
      error: 'Apenas o dono pode excluir.',
    });
    expect(built.code).toBe('forbidden');
    expect(built.message).toBe('Apenas o dono pode excluir.');
  });
});
