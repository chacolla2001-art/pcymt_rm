#!/usr/bin/env bash
# =============================================================================
# PCyMT RM — Setup Supabase (uploads + migrate + seed)
#
# Configura el backend para usar PostgreSQL en Supabase vía Supabase CLI:
#   1. Autentica con Supabase (si hace falta)
#   2. Enlaza el proyecto remoto
#   3. Genera/actualiza apps/backend/.env con DATABASE_URL
#   4. Copia assets 3D a shared/uploads/
#   5. Ejecuta migraciones y seeders Sequelize
#
# Uso:
#   ./scripts/setup-supabase.sh
#   SUPABASE_PROJECT_REF=abc123 SUPABASE_DB_PASSWORD=secret ./scripts/setup-supabase.sh
#   ./scripts/setup-supabase.sh --skip-seed
#   ./scripts/setup-supabase.sh --uploads-only
#
# Requisitos: Node.js 20+, npm, Supabase CLI (~/.local/bin/supabase)
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
UPLOADS_DIR="$ROOT_DIR/shared/uploads"
MODELS_SRC="$ROOT_DIR/apps/mobile-android/app/src/main/assets/models"
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

export PATH="${HOME}/.local/bin:${PATH}"

SKIP_SEED=false
UPLOADS_ONLY=false
FORCE_LINK=false

for arg in "$@"; do
  case "$arg" in
    --skip-seed) SKIP_SEED=true ;;
    --uploads-only) UPLOADS_ONLY=true ;;
    --force-link) FORCE_LINK=true ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $arg (usa --help)"
      exit 1
      ;;
  esac
done

log()  { printf '\033[1;34m▶\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando requerido no encontrado: $1"
}

urlencode() {
  node -e "console.log(encodeURIComponent(process.argv[1]))" "$1"
}

generate_jwt_secret() {
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
}

ensure_supabase_cli() {
  require_cmd supabase
  ok "Supabase CLI $(supabase --version 2>/dev/null | head -1)"
}

ensure_supabase_login() {
  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    supabase login --token "$SUPABASE_ACCESS_TOKEN" --name pcymt-rm >/dev/null
    ok "Supabase CLI autenticado (SUPABASE_ACCESS_TOKEN)"
    return
  fi

  if supabase projects list >/dev/null 2>&1; then
    ok "Supabase CLI autenticado"
    return
  fi

  if [[ -t 0 ]]; then
    log "Iniciando login de Supabase CLI (se abrirá el navegador)..."
    supabase login || fail "No se pudo autenticar con Supabase CLI"
    ok "Supabase CLI autenticado"
    return
  fi

  cat <<'EOF'

✗ Supabase CLI no autenticado y esta terminal no es interactiva.

Opciones:
  1. Crear token en https://supabase.com/dashboard/account/tokens
     y ejecutar:
       export SUPABASE_ACCESS_TOKEN="sbp_..."
       ./scripts/setup-supabase.sh

  2. En una terminal interactiva:
       supabase login
       ./scripts/setup-supabase.sh

EOF
  fail "Autenticación Supabase requerida"
}

ensure_supabase_project() {
  cd "$ROOT_DIR"

  if [[ ! -f "$ROOT_DIR/supabase/config.toml" ]]; then
    log "Inicializando carpeta supabase/ (solo para link con el proyecto remoto)..."
    supabase init
  fi

  if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    PROJECT_REF="$SUPABASE_PROJECT_REF"
  else
    log "Proyectos disponibles en tu cuenta Supabase:"
    supabase projects list || fail "No se pudieron listar proyectos. ¿Estás autenticado?"
    echo
    read -rp "Project ref (ej. abcdefghijklmnop): " PROJECT_REF
    [[ -n "$PROJECT_REF" ]] || fail "Project ref requerido"
  fi

  if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    read -rsp "Contraseña de la base de datos Supabase (postgres): " SUPABASE_DB_PASSWORD
    echo
    [[ -n "$SUPABASE_DB_PASSWORD" ]] || fail "SUPABASE_DB_PASSWORD requerida"
  fi

  if [[ "$FORCE_LINK" == true ]] || ! supabase projects list 2>/dev/null | grep -q "$PROJECT_REF"; then
    :
  fi

  log "Enlazando proyecto Supabase: $PROJECT_REF"
  supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --yes

  ENCODED_PASS="$(urlencode "$SUPABASE_DB_PASSWORD")"
  DATABASE_URL="postgresql://postgres:${ENCODED_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"

  ok "Proyecto enlazado: $PROJECT_REF"
  export SUPABASE_PROJECT_REF="$PROJECT_REF"
  export DATABASE_URL
}

setup_uploads() {
  log "Configurando shared/uploads/..."

  mkdir -p "$UPLOADS_DIR"/{map-icons,profile-photos}

  if [[ -d "$MODELS_SRC" ]]; then
    local copied=0
    for glb in "$MODELS_SRC"/*.glb; do
      [[ -f "$glb" ]] || continue
      base="$(basename "$glb")"
      [[ "$base" == "cube.glb" ]] && continue
      cp -n "$glb" "$UPLOADS_DIR/$base" 2>/dev/null || cp "$glb" "$UPLOADS_DIR/$base"
      copied=$((copied + 1))
    done
    ok "Modelos 3D copiados: $copied archivos .glb"
  else
    warn "No se encontró $MODELS_SRC — omite modelos 3D"
  fi

  local icons=(bear cattle chicken cow dog horse leopard lizard mermaid pig tiger viper)
  local missing_icons=0
  for name in "${icons[@]}"; do
    if [[ ! -f "$UPLOADS_DIR/${name}.png" ]]; then
      missing_icons=$((missing_icons + 1))
    fi
  done

  if [[ "$missing_icons" -gt 0 ]]; then
    warn "Faltan $missing_icons iconos PNG en shared/uploads/ (bear.png, etc.)"
    warn "El seed funcionará, pero /api/files/*.png no servirá hasta que los agregues."
  else
    ok "Iconos PNG presentes en shared/uploads/"
  fi

  if [[ ! -f "$UPLOADS_DIR/map-icons/map-config.json" ]] && [[ -f "$ROOT_DIR/shared/uploads/map-icons/map-config.json" ]]; then
    ok "map-config.json ya presente"
  fi
}

write_backend_env() {
  log "Generando $ENV_FILE ..."

  local jwt_secret jwt_refresh
  if [[ -f "$ENV_FILE" ]]; then
    jwt_secret="$(grep -E '^JWT_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)"
    jwt_refresh="$(grep -E '^JWT_REFRESH_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)"
  fi
  [[ -n "$jwt_secret" && ${#jwt_secret} -ge 64 ]] || jwt_secret="$(generate_jwt_secret)"
  [[ -n "$jwt_refresh" && ${#jwt_refresh} -ge 64 ]] || jwt_refresh="$(generate_jwt_secret)"

  cat > "$ENV_FILE" <<EOF
# Generado por scripts/setup-supabase.sh — $(date -Iseconds)
DATABASE_URL=${DATABASE_URL}

PORT=5000
NODE_ENV=development
DB_SSL=true

JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=${jwt_refresh}
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:4200
UPLOAD_DIR=../../shared/uploads
MAX_FILE_SIZE=52428800

SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF}

# Completar manualmente si los necesitas:
# GOOGLE_CLIENT_ID=
# GOOGLE_ANDROID_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# EMAIL_USER=
# EMAIL_PASS=
EOF

  ok "Archivo .env del backend actualizado"
}

run_migrations_and_seed() {
  log "Instalando dependencias del backend..."
  cd "$BACKEND_DIR"
  npm install --silent

  log "Ejecutando migraciones Sequelize contra Supabase..."
  NODE_ENV=development npm run db:migrate:all

  if [[ "$SKIP_SEED" == true ]]; then
    warn "Seed omitido (--skip-seed)"
  else
    log "Ejecutando seeders..."
    NODE_ENV=development npm run db:seed:all
    ok "Base de datos migrada y sembrada"
  fi
}

verify_connection() {
  log "Verificando conexión a la base de datos..."
  cd "$BACKEND_DIR"
  node - <<'NODE'
require('dotenv').config();
const { Sequelize } = require('sequelize');
const url = process.env.DATABASE_URL;
const sequelize = new Sequelize(url, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});
sequelize.authenticate()
  .then(() => { console.log('OK'); return sequelize.close(); })
  .catch((err) => { console.error(err.message); process.exit(1); });
NODE
  ok "Conexión a Supabase verificada"
}

main() {
  echo
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  PCyMT RM — Setup Supabase (DB + Uploads)         ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo

  require_cmd node
  require_cmd npm
  ensure_supabase_cli

  setup_uploads

  if [[ "$UPLOADS_ONLY" == true ]]; then
    ok "Solo uploads (--uploads-only). Listo."
    exit 0
  fi

  ensure_supabase_login
  ensure_supabase_project
  write_backend_env
  verify_connection
  run_migrations_and_seed

  echo
  ok "Setup completado"
  echo "  Backend .env : $ENV_FILE"
  echo "  Uploads      : $UPLOADS_DIR"
  echo "  Supabase ref : ${SUPABASE_PROJECT_REF}"
  echo
  echo "Siguiente paso: cd apps/backend && npm run dev"
  echo
}

main "$@"
