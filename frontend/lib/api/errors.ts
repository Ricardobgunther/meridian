import type {
  ApiError,
  ApiErrorCode,
} from '@/lib/types/api';

/**
 * Mensagens PT-BR para uso em toast/banner. `title` é o cabeçalho curto,
 * `message` é o detalhe. `fieldErrors` carrega o primeiro erro por campo
 * quando o backend retorna o formato Laravel 422.
 */
export interface ParsedApiError {
  title: string;
  message: string;
  fieldErrors?: Record<string, string>;
  code: ApiErrorCode;
  status: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function classifyStatus(status: number): ApiErrorCode {
  if (status === 0) return 'network';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  if (status >= 400) return 'unknown';
  return 'unknown';
}

/**
 * Normaliza qualquer resposta de erro (Response ou TypeError) no shape ApiError.
 * Usado pelo `apiFetch` antes de lançar.
 */
export async function buildApiError(
  status: number,
  body: unknown,
): Promise<ApiError> {
  const code = classifyStatus(status);
  const parsed = parseApiErrorPayload(status, body);
  return {
    status,
    code,
    message: parsed.message,
    fieldErrors: extractRawFieldErrors(body),
    raw: body,
  };
}

function extractRawFieldErrors(
  body: unknown,
): Record<string, string[]> | undefined {
  if (!isRecord(body)) return undefined;
  const errors = body.errors;
  if (!isRecord(errors)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(errors)) {
    if (Array.isArray(v)) {
      out[k] = v.filter((x): x is string => typeof x === 'string');
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const msg = body.message ?? body.error;
  return typeof msg === 'string' && msg.trim().length > 0 ? msg : null;
}

/**
 * Mapeia status + body para uma mensagem PT-BR já amigável.
 * Não é exposta diretamente — `parseApiError` é o ponto de entrada para a UI.
 */
function parseApiErrorPayload(status: number, body: unknown): { message: string } {
  const serverMessage = readMessage(body);

  switch (status) {
    case 0:
      return { message: 'Verifique sua internet e tente novamente.' };
    case 400:
      return {
        message: serverMessage ?? 'Solicitação inválida. Verifique os dados.',
      };
    case 401:
      return { message: 'Sua sessão expirou. Faça login novamente.' };
    case 403:
      return {
        message: serverMessage ?? 'Você não tem permissão para esta ação.',
      };
    case 404:
      return { message: serverMessage ?? 'Recurso não encontrado.' };
    case 422:
      return {
        message:
          serverMessage ?? 'Verifique os campos destacados e tente de novo.',
      };
    case 429:
      return { message: 'Aguarde alguns instantes e tente novamente.' };
    default:
      if (status >= 500) {
        return {
          message:
            'Algo deu errado do nosso lado. Tente novamente em instantes.',
        };
      }
      return {
        message: serverMessage ?? 'Não foi possível concluir a ação.',
      };
  }
}

function titleForCode(code: ApiErrorCode, status: number): string {
  switch (code) {
    case 'network':
      return 'Sem conexão';
    case 'unauthorized':
      return 'Sessão expirada';
    case 'forbidden':
      return 'Sem permissão';
    case 'not_found':
      return 'Não encontrado';
    case 'validation':
      return 'Verifique os campos';
    case 'rate_limited':
      return 'Muitas tentativas';
    case 'server':
      return 'Erro inesperado';
    default:
      return status >= 400 ? 'Algo deu errado' : 'Atenção';
  }
}

function isApiError(err: unknown): err is ApiError {
  return (
    isRecord(err) &&
    typeof err.status === 'number' &&
    typeof err.code === 'string' &&
    typeof err.message === 'string'
  );
}

/**
 * Converte qualquer erro (ApiError do wrapper, TypeError de fetch, throws
 * arbitrários) em uma forma pronta para exibição: { title, message, fieldErrors }.
 *
 * Componentes nunca leem `Response` cru — sempre passam pelo parser.
 */
export function parseApiError(err: unknown): ParsedApiError {
  // ApiError gerado por apiFetch
  if (isApiError(err)) {
    const fieldErrors = err.fieldErrors
      ? Object.fromEntries(
          Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0] ?? '']),
        )
      : undefined;
    return {
      title: titleForCode(err.code, err.status),
      message: err.message,
      fieldErrors,
      code: err.code,
      status: err.status,
    };
  }

  // TypeError de fetch (rede caiu, CORS, etc.)
  if (err instanceof TypeError) {
    return {
      title: 'Sem conexão',
      message: 'Verifique sua internet e tente novamente.',
      code: 'network',
      status: 0,
    };
  }

  // AbortError — quando o caller cancelou a request.
  if (err instanceof DOMException && err.name === 'AbortError') {
    return {
      title: 'Cancelado',
      message: 'A operação foi cancelada.',
      code: 'unknown',
      status: 0,
    };
  }

  if (err instanceof Error) {
    return {
      title: 'Algo deu errado',
      message: 'Não foi possível concluir a ação. Tente novamente.',
      code: 'unknown',
      status: 0,
    };
  }

  return {
    title: 'Algo deu errado',
    message: 'Não foi possível concluir a ação. Tente novamente.',
    code: 'unknown',
    status: 0,
  };
}
