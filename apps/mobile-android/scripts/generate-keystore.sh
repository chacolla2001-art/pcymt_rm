#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_DIR="$(cd "$(dirname "$0")/.." && pwd)/keystore"
KEYSTORE_FILE="$KEYSTORE_DIR/release.keystore"

mkdir -p "$KEYSTORE_DIR"

if [[ -f "$KEYSTORE_FILE" ]]; then
  echo "Keystore already exists at: $KEYSTORE_FILE"
  echo "Delete it first if you want to generate a new one."
  exit 1
fi

read -r -p "Keystore password: " -s STORE_PASS; echo
read -r -p "Key alias [release]: " KEY_ALIAS; KEY_ALIAS=${KEY_ALIAS:-release}
read -r -p "Key password (Enter to reuse keystore password): " -s KEY_PASS; echo
KEY_PASS=${KEY_PASS:-$STORE_PASS}

keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Pedro Chacolla, OU=Mobile, O=UniValle, L=Cali, ST=Valle, C=CO"

cat > "$(dirname "$0")/../key.properties" <<EOF
storePassword=$STORE_PASS
keyPassword=$KEY_PASS
keyAlias=$KEY_ALIAS
storeFile=keystore/release.keystore
EOF

echo
echo "Keystore created: $KEYSTORE_FILE"
echo "key.properties updated."
