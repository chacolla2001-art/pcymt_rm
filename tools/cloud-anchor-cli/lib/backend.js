/**
 * lib/backend.js — Cliente para el backend local PCyMT RM
 *
 * Permite CRUD completo de Anchor Points y Virtual Assets.
 * Se autentica vía JWT (email + password).
 */

'use strict';

const axios = require('axios');

let _baseUrl = 'http://localhost:5000';
let _token = null;

// ── Init ──────────────────────────────────────────────────────────────────────

function init(baseUrl) {
  _baseUrl = baseUrl.replace(/\/$/, '');
}

function isAuthenticated() {
  return !!_token;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await axios.post(`${_baseUrl}/api/auth/login`, {
    email,
    password,
    platform: 'desktop',
  }, { timeout: 8000 });

  const data = res.data?.data;
  const token = data?.accessToken ?? data?.token ?? data?.access_token;
  if (!token) throw new Error('El backend no retornó un token de acceso.');
  _token = token;
  return token;
}

async function checkAvailable() {
  try {
    const res = await axios.get(`${_baseUrl}/health`, { timeout: 4000 });
    return res.status === 200;
  } catch {
    // Fallback: try a simple GET to the base URL (in case /health is broken)
    try {
      await axios.get(`${_baseUrl}/`, { timeout: 4000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ── HTTP client ───────────────────────────────────────────────────────────────

function client() {
  if (!_token) throw new Error('No autenticado en el backend. Inicia el backend primero.');
  return axios.create({
    baseURL: _baseUrl,
    timeout: 10_000,
    headers: { Authorization: `Bearer ${_token}` },
  });
}

// ── Anchor Points ─────────────────────────────────────────────────────────────

async function getAnchorPoints() {
  const res = await client().get('/api/anchor-points');
  return res.data?.data ?? [];
}

async function getActiveAnchorPoints() {
  const res = await client().get('/api/anchor-points/active');
  return res.data?.data ?? [];
}

async function getAnchorPointById(id) {
  const res = await client().get(`/api/anchor-points/${id}`);
  return res.data?.data;
}

async function createAnchorPoint(data) {
  const res = await client().post('/api/anchor-points', data);
  return res.data?.data;
}

async function updateAnchorPoint(id, data) {
  const res = await client().put(`/api/anchor-points/${id}`, data);
  return res.data?.data;
}

async function deleteAnchorPoint(id) {
  await client().delete(`/api/anchor-points/${id}`);
}

async function updateAnchorCode(id, anchorCode) {
  return updateAnchorPoint(id, { anchor_code: anchorCode });
}

async function clearAnchorCode(id) {
  return updateAnchorCode(id, null);
}

// ── Virtual Assets ────────────────────────────────────────────────────────────

async function getVirtualAssets() {
  const res = await client().get('/api/virtual-assets');
  return res.data?.data ?? [];
}

async function getActiveVirtualAssets() {
  const res = await client().get('/api/virtual-assets/active');
  return res.data?.data ?? [];
}

// ── Config ────────────────────────────────────────────────────────────────────

async function getConfig() {
  const res = await axios.get(`${_baseUrl}/api/config`, { timeout: 5000 });
  return res.data?.data ?? {};
}

// ── Statistics ────────────────────────────────────────────────────────────────

async function getStats() {
  const res = await client().get('/api/analytics/totals');
  return res.data?.data ?? {};
}

module.exports = {
  init,
  isAuthenticated,
  login,
  checkAvailable,
  getAnchorPoints,
  getActiveAnchorPoints,
  getAnchorPointById,
  createAnchorPoint,
  updateAnchorPoint,
  deleteAnchorPoint,
  updateAnchorCode,
  clearAnchorCode,
  getVirtualAssets,
  getActiveVirtualAssets,
  getConfig,
  getStats,
};
