#!/usr/bin/env node
/**
 * Audita el bucket Supabase Storage: jerarquía, objetos legacy vs canónico.
 * Uso:
 *   node scripts/audit-supabase-storage.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-supabase-storage.mjs
 *
 * Carga .env desde apps/backend/.env o /tmp/pcymt-api-env.txt (vercel env pull).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, 'apps/backend/.env'));
loadEnvFile('/tmp/pcymt-api-env.txt');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'fjypkthrwysjvcbdpgtq';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = (process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`).replace(/\/$/, '');

const CANONICAL_PREFIXES = [
  'model-icons/',
  'profile-pictures/',
  'map-models/',
  'map-icons/',
  'map-stickers/',
];

const LEGACY_PATTERNS = [
  /^avatars\//,
  /^profile-pictures\/profile_picture_url-/,
  /^profile-pictures\/[^/]+\.(jpg|jpeg|png)$/i, // non-uuid legacy names
];

const UUID_WEBP = /^profile-pictures\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

async function listFolder(prefix = '') {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY required');

  const url = `${BASE_URL}/storage/v1/object/list/${BUCKET}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List failed (${prefix || 'root'}): ${res.status} ${text}`);
  }

  return res.json();
}

async function headObject(objectPath) {
  const encoded = objectPath.split('/').map((s) => encodeURIComponent(s)).join('/');
  const url = `${BASE_URL}/storage/v1/object/${BUCKET}/${encoded}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      Range: 'bytes=0-0',
    },
  });
  return {
    objectPath,
    status: res.status,
    ok: res.ok || res.status === 206,
    contentType: res.headers.get('content-type'),
    size: res.headers.get('content-range') || res.headers.get('content-length'),
  };
}

async function walk(prefix = '', depth = 0, maxDepth = 3) {
  const items = await listFolder(prefix);
  const files = [];
  const folders = [];

  for (const item of items) {
    const name = item.name;
    if (!name) continue;
    const full = prefix ? `${prefix}${name}` : name;

    if (item.id === null && !name.includes('.')) {
      const folderPrefix = prefix ? `${prefix}${name}/` : `${name}/`;
      folders.push(folderPrefix);
    } else {
      files.push({ path: full, metadata: item.metadata });
    }
  }

  if (depth < maxDepth) {
    for (const folder of folders) {
      const nested = await walk(folder, depth + 1, maxDepth);
      files.push(...nested);
    }
  }

  return files;
}

function classify(pathStr) {
  if (UUID_WEBP.test(pathStr)) return 'canonical-profile';
  if (pathStr.startsWith('model-icons/')) return 'canonical-predefined';
  for (const re of LEGACY_PATTERNS) {
    if (re.test(pathStr)) return 'legacy';
  }
  if (pathStr.startsWith('profile-pictures/')) return 'profile-other';
  return 'other';
}

async function main() {
  console.log('\n=== Supabase Storage Audit ===');
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Bucket:  ${BUCKET}`);
  console.log(`Service key: ${SERVICE_KEY ? 'configured' : 'MISSING'}\n`);

  if (!SERVICE_KEY) {
    console.error('Export SUPABASE_SERVICE_ROLE_KEY or run: vercel env pull /tmp/pcymt-api-env.txt --environment=production');
    process.exit(1);
  }

  const allFiles = await walk('', 0, 2);
  const profileFolder = await listFolder('profile-pictures/');
  for (const item of profileFolder) {
    if (item.name) allFiles.push({ path: `profile-pictures/${item.name}`, metadata: item.metadata });
  }

  const byClass = {};
  const byTopFolder = {};

  for (const f of allFiles) {
    const cls = classify(f.path);
    byClass[cls] = byClass[cls] || [];
    byClass[cls].push(f.path);
    const top = f.path.split('/')[0] || '(root)';
    byTopFolder[top] = (byTopFolder[top] || 0) + 1;
  }

  console.log('--- Top-level folders (file count) ---');
  Object.entries(byTopFolder).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}/  ${v} files`));

  console.log('\n--- Classification ---');
  for (const [cls, paths] of Object.entries(byClass).sort()) {
    console.log(`\n[${cls}] (${paths.length})`);
    paths.slice(0, 15).forEach((p) => console.log(`  • ${p}`));
    if (paths.length > 15) console.log(`  … +${paths.length - 15} more`);
  }

  const adminId = '550e8400-e29b-41d4-a716-446655440001';
  const adminPath = `profile-pictures/${adminId}.webp`;
  console.log('\n--- Admin profile picture (HEAD) ---');
  const head = await headObject(adminPath);
  console.log(`  ${head.objectPath}: HTTP ${head.status}, ${head.contentType || '?'}, ${head.size || '?'} bytes`);

  console.log('\n--- Expected hierarchy ---');
  console.log('  uploads/');
  console.log('    model-icons/*.png          ← predefinidos (script upload-avatars-supabase.js)');
  console.log('    profile-pictures/{uuid}.webp ← fotos personalizadas (API upload)');
  console.log('    map-models/*.glb           ← modelos 3D');
  console.log('    (legacy) avatars/          ← NO usar, migrar a model-icons/');

  const legacyCount = (byClass.legacy || []).length;
  const canonicalProfile = (byClass['canonical-profile'] || []).length;
  console.log(`\n=== Summary: ${canonicalProfile} canonical profile photos, ${legacyCount} legacy objects ===\n`);

  if (legacyCount > 0) {
    console.log('⚠ Legacy objects found — safe to delete after users re-upload or pick predefined avatar.');
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
