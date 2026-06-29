#!/usr/bin/env node
/**
 * Sube iconos de avatares predefinidos a Supabase Storage (bucket uploads/model-icons/)
 * Uso: node scripts/upload-avatars-supabase.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv(path.join(__dirname, '../apps/backend/.env'));

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'fjypkthrwysjvcbdpgtq';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AVATARS_DIR = path.join(__dirname, '../shared/uploads/model-icons');

async function uploadFile(filePath, objectPath) {
  const body = fs.readFileSync(filePath);
  const url = `https://${PROJECT_REF}.supabase.co/storage/v1/object/${BUCKET}/${objectPath}`;

  const headers = {
    'Content-Type': 'image/png',
    'x-upsert': 'true',
  };

  if (SERVICE_KEY) {
    headers.Authorization = `Bearer ${SERVICE_KEY}`;
    headers.apikey = SERVICE_KEY;
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${objectPath}: ${res.status} ${text}`);
  }
  console.log(`✓ ${objectPath}`);
}

async function main() {
  if (!fs.existsSync(AVATARS_DIR)) {
    console.error('No existe', AVATARS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(AVATARS_DIR).filter((f) => f.endsWith('.png'));
  console.log(`Subiendo ${files.length} avatares a Supabase...`);

  for (const file of files) {
    await uploadFile(path.join(AVATARS_DIR, file), `model-icons/${file}`);
  }

  console.log('Listo.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
