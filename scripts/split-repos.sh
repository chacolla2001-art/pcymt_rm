#!/usr/bin/env bash
# Genera repos independientes desde el monorepo (ejecutar desde la raíz del monorepo)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/pcymt-split-$$"
FILTER_REPO="$(python3 -c 'import shutil; print(shutil.which("git-filter-repo") or __import__("os").path.expanduser("~/.local/bin/git-filter-repo"))')"

if [[ ! -x "$FILTER_REPO" ]]; then
  python3 -m pip install --user git-filter-repo
  FILTER_REPO="$HOME/.local/bin/git-filter-repo"
fi

mkdir -p "$WORKDIR"
git clone --no-local "$ROOT" "$WORKDIR/source"
cd "$WORKDIR/source"

split_and_push() {
  local name=$1
  shift
  local paths=("$@")
  local dest="$WORKDIR/$name"

  git clone --no-local "$WORKDIR/source" "$dest"
  cd "$dest"

  local args=()
  for p in "${paths[@]}"; do
    args+=(--path "$p")
  done
  # Renombrar primer path a raíz del repo
  args+=(--path-rename "${paths[0]}/:")

  "$FILTER_REPO" "${args[@]}"
  git remote add origin "https://github.com/chacolla2001-art/${name}.git"
  git branch -M main
  git push -u origin main --force
  echo "✓ Pushed $name"
  cd "$WORKDIR/source"
}

split_and_push pcymt-rm-api apps/backend
split_and_push pcymt-rm-web apps/web-admin
split_and_push pcymt-rm-android apps/mobile-android

echo "Repos listos: pcymt-rm-api, pcymt-rm-web, pcymt-rm-android"
rm -rf "$WORKDIR"
