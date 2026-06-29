#!/bin/bash
# Levanta backend y frontend en paralelo desde la raíz del monorepo.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "Iniciando PCyMT RM (backend :5000 + frontend :4200)..."
echo "Ctrl+C para detener ambos."

trap 'kill 0' EXIT

npm run dev --prefix apps/backend &
npm start --prefix apps/web-admin &
wait
