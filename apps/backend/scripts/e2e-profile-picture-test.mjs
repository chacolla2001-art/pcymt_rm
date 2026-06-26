#!/usr/bin/env node
/**
 * Prueba E2E real: login → subir foto → descargar vía /api/files/
 * Uso: node scripts/e2e-profile-picture-test.mjs [API_BASE_URL]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = (process.argv[2] || process.env.API_URL || 'https://pcymt-rm-api.vercel.app').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.E2E_EMAIL || 'chacolla43@gmail.com';
const ADMIN_PASSWORD = process.env.E2E_PASSWORD || 'Cybercenter1';

const SAMPLE_IMAGE = path.resolve(
  __dirname,
  '../../../shared/uploads/model-icons/chicken.png',
);

function log(step, msg, extra = {}) {
  const prefix = extra.ok === true ? '✓' : extra.ok === false ? '✗' : '→';
  console.log(`${prefix} [${step}] ${msg}`);
  if (extra.detail) console.log(`    ${extra.detail}`);
}

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      platform: 'web',
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success || !body.data?.token) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return {
    token: body.data.token,
    userId: String(body.data.user.id),
    avatarUrlBefore: body.data.user.avatar_url ?? null,
  };
}

async function uploadProfilePicture(token, userId) {
  const buffer = fs.readFileSync(SAMPLE_IMAGE);
  const form = new FormData();
  form.append('profile_picture_url', new Blob([buffer], { type: 'image/png' }), 'e2e-test.png');

  const res = await fetch(`${API_BASE}/api/users/${userId}/profile-picture`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(`Upload failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function downloadAvatar(token, avatarPath) {
  const url = `${API_BASE}${avatarPath}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    size: buffer.length,
    buffer,
    url,
  };
}

async function checkSupabasePublic(objectPath) {
  const ref = process.env.SUPABASE_PROJECT_REF || 'fjypkthrwysjvcbdpgtq';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
  const segments = objectPath.split('/').map((s) => encodeURIComponent(s)).join('/');
  const publicUrl = `https://${ref}.supabase.co/storage/v1/object/public/${bucket}/${segments}`;
  const res = await fetch(publicUrl, { method: 'HEAD' });
  return { publicUrl, status: res.status, ok: res.ok };
}

async function main() {
  console.log(`\n=== E2E Profile Picture Test ===`);
  console.log(`API: ${API_BASE}\n`);

  if (!fs.existsSync(SAMPLE_IMAGE)) {
    throw new Error(`Sample image not found: ${SAMPLE_IMAGE}`);
  }

  let passed = 0;
  let failed = 0;

  const assert = (name, condition, detail) => {
    if (condition) {
      passed += 1;
      log(name, 'OK', { ok: true, detail });
    } else {
      failed += 1;
      log(name, 'FAILED', { ok: false, detail });
    }
  };

  try {
    log('1-login', `Authenticating as ${ADMIN_EMAIL}...`);
    const { token, userId, avatarUrlBefore } = await login();
    log('1-login', `userId=${userId}`, { ok: true });
    log('1-login', `avatar_url before: ${avatarUrlBefore ?? '(null)'}`, { ok: true });

    const expectedPath = `/api/files/profile-pictures/${userId}.webp`;

    log('2-upload', 'Uploading PNG via PATCH /profile-picture...');
    const uploadData = await uploadProfilePicture(token, userId);
    const avatarUrl = uploadData.avatar_url || uploadData.profile_picture_url;
    log('2-upload', `Response avatar_url: ${avatarUrl}`, { ok: true });

    assert('canonical-path', avatarUrl === expectedPath, `expected ${expectedPath}`);

    log('3-download', 'Downloading via authenticated /api/files/...');
    const dl = await downloadAvatar(token, avatarUrl);
    log('3-download', `HTTP ${dl.status}, ${dl.contentType}, ${dl.size} bytes`, {
      ok: dl.status === 200 && dl.size > 0,
    });

    assert('download-status', dl.status === 200, `got ${dl.status}`);
    assert('download-size', dl.size > 500, `only ${dl.size} bytes`);
    assert(
      'download-is-image',
      (dl.contentType || '').includes('image'),
      dl.contentType || 'no content-type',
    );

    const isWebp = dl.buffer[0] === 0x52 && dl.buffer[1] === 0x49; // RIFF (webp)
    const isPng = dl.buffer[0] === 0x89 && dl.buffer[1] === 0x50;
    assert('processed-format', isWebp || isPng, isWebp ? 'WebP (sharp processed)' : isPng ? 'PNG (fallback)' : 'unknown magic bytes');

    const objectPath = `profile-pictures/${userId}.webp`;
    log('4-supabase', `Checking Supabase object HEAD ${objectPath}...`);
    const sb = await checkSupabasePublic(objectPath);
    log('4-supabase', `Public URL → HTTP ${sb.status}`, { ok: sb.ok });
    if (sb.ok) {
      assert('supabase-object-exists', true, sb.publicUrl);
    } else {
      log('4-supabase', 'Public bucket not accessible (private bucket is OK if API download works)', { ok: true });
      assert('api-serves-storage', dl.status === 200 && dl.size > 500, 'API streams file even if public URL blocked');
    }

    log('5-idempotent', 'Second upload (upsert same path)...');
    const upload2 = await uploadProfilePicture(token, userId);
    assert('upsert-same-url', upload2.avatar_url === expectedPath, upload2.avatar_url);

    const dl2 = await downloadAvatar(token, expectedPath);
    assert('download-after-upsert', dl2.status === 200 && dl2.size > 500, `${dl2.status} ${dl2.size}b`);

    log('6-predefined', 'Switching to predefined avatar (bear)...');
    const setRes = await fetch(`${API_BASE}/api/users/${userId}/avatar`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ avatar_id: 'bear' }),
    });
    const setBody = await setRes.json();
    assert('set-predefined', setRes.ok && setBody.success, JSON.stringify(setBody?.data));
    const bearPath = setBody.data?.avatar_url;
    const dlBear = await downloadAvatar(token, bearPath);
    assert('download-bear', dlBear.status === 200 && dlBear.size > 0, `${dlBear.status}`);

    console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n✗ E2E test aborted:', error.message);
    process.exit(1);
  }
}

main();
