/**
 * lib/auth.js — Token para ARCore Cloud Anchor Management API
 *
 * La ARCore Management REST API v1beta2 requiere OAuth2 scope "arcore.management".
 * Según la documentación oficial de Google, la forma correcta es:
 *   1. Crear una Service Account en Google Cloud Console
 *   2. Descargar la key JSON
 *   3. Generar token con scope "arcore.management"
 *
 * Ref: https://developers.google.com/ar/develop/cloud-anchors/management-api
 *
 * Esta implementación usa google-auth-library con Service Account (JWT).
 */

'use strict';

const { GoogleAuth } = require('google-auth-library');
const fs   = require('fs');
const path = require('path');

const SCOPE = 'https://www.googleapis.com/auth/arcore.management';

// Ubicaciones por defecto para la key de service account
const DEFAULT_PATHS = [
  path.join(__dirname, '..', 'service-account.json'),
  path.join(__dirname, '..', 'sa-key.json'),
];

let _cachedToken = null;
let _tokenExpiry  = 0;

/**
 * Localiza el archivo de service account.
 * Prioridad: env var > archivos por defecto.
 */
function findKeyFile() {
  const envPath = process.env.SERVICE_ACCOUNT_PATH;
  if (envPath) {
    const resolved = path.resolve(envPath);
    if (fs.existsSync(resolved)) return resolved;
    return null;
  }
  for (const p of DEFAULT_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Verifica si hay un archivo de service account configurado.
 */
function isConfigured() {
  return !!findKeyFile();
}

/**
 * Genera un access token usando la Service Account con scope arcore.management.
 * @param {boolean} forceNew - Ignorar cache
 * @returns {Promise<string>} access_token
 */
async function getAccessToken(forceNew = false) {
  // Return cached if valid
  if (!forceNew && _cachedToken && Date.now() < _tokenExpiry - 60_000) {
    return _cachedToken;
  }

  const keyFile = findKeyFile();
  if (!keyFile) {
    throw new Error(
      'No se encontró el archivo de Service Account.\n' +
      '  Opciones:\n' +
      '  1. Coloca service-account.json en la carpeta del CLI\n' +
      '  2. Define SERVICE_ACCOUNT_PATH en .env\n\n' +
      '  Para crear la Service Account:\n' +
      '  → Google Cloud Console → IAM & Admin → Service Accounts\n' +
      '  → Crear cuenta → Descargar key JSON'
    );
  }

  const auth = new GoogleAuth({
    keyFile,
    scopes: [SCOPE],
  });

  const client = await auth.getClient();
  const res = await client.getAccessToken();
  const token = res.token ?? res;

  if (!token || typeof token !== 'string') {
    throw new Error('No se pudo obtener access token de la Service Account.');
  }

  _cachedToken = token;
  // JWT tokens from service accounts last 1 hour
  _tokenExpiry = Date.now() + 55 * 60 * 1000;

  return token;
}

/**
 * Limpia el token en cache.
 */
function clearToken() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

/**
 * Devuelve info de la service account (email, project_id).
 */
function getServiceAccountInfo() {
  const keyFile = findKeyFile();
  if (!keyFile) return null;
  try {
    const data = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    return {
      email: data.client_email,
      projectId: data.project_id,
      keyFile,
    };
  } catch {
    return null;
  }
}

module.exports = {
  getAccessToken,
  clearToken,
  isConfigured,
  findKeyFile,
  getServiceAccountInfo,
  SCOPE,
};
