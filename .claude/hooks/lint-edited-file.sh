#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): checa a sintaxe/tipos de arquivos recém-editados.
# O Claude Code entrega o payload da ferramenta como JSON no stdin.
set -u

payload="$(cat)"

# Extrai tool_input.file_path sem jq (não instalado neste ambiente).
file="$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')"

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

PROJECT_ROOT="/root/projetos/Projeto1"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

case "$file" in
  *.php)
    command -v php >/dev/null 2>&1 || exit 0
    if out="$(php -l "$file" 2>&1)"; then
      echo "[hook] PHP OK: $file"
      exit 0
    fi
    echo "[hook] Erro de sintaxe PHP em $file:" >&2
    echo "$out" >&2
    exit 2  # exit 2 devolve o stderr ao Claude para correção imediata
    ;;
  *.ts|*.tsx)
    # Só checa arquivos dentro de frontend/.
    case "$file" in
      "$FRONTEND_DIR"/*) ;;
      *) exit 0 ;;
    esac

    # Precisa de node_modules instalado (npx --no-install não baixa nada).
    [ -d "$FRONTEND_DIR/node_modules" ] || exit 0
    [ -x "$FRONTEND_DIR/node_modules/.bin/tsc" ] || exit 0
    command -v npx >/dev/null 2>&1 || exit 0

    # tsc não suporta type-check de arquivo isolado preservando inferência
    # cross-file; rodamos o projeto inteiro a partir do tsconfig do frontend.
    if out="$(cd "$FRONTEND_DIR" && npx --no-install tsc --noEmit --pretty false -p tsconfig.json 2>&1)"; then
      echo "[hook] TS OK: $file"
      exit 0
    fi
    echo "[hook] Erro de tipos TypeScript (frontend) ao editar $file:" >&2
    echo "$out" >&2
    exit 2
    ;;
esac

exit 0
