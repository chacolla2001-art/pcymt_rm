#!/usr/bin/env bash
# Autentica Supabase CLI (terminal interactiva).
# Uso:
#   ./scripts/supabase-login.sh
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/supabase-login.sh

set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  supabase login --token "$SUPABASE_ACCESS_TOKEN" --name pcymt-rm
  echo "✓ Autenticado con token"
  supabase projects list
  exit 0
fi

echo "Abriendo login de Supabase en el navegador..."
supabase login
echo "✓ Autenticado"
supabase projects list
