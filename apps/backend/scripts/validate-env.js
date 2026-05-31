#!/usr/bin/env node
/**
 * Security Validator - Validates .env configuration
 * Run: node scripts/validate-env.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');

// Check if .env exists
if (!fs.existsSync(envPath)) {
  console.error('[ENV] ERROR: .env file not found!');
  console.error('[ENV] ACTION: Copy .env.example to .env');
  process.exit(1);
}

// Suppress dotenv tips by temporarily overriding console.log
const originalLog = console.log;
console.log = (...args) => {
  const msg = args[0];
  if (typeof msg === 'string' && msg.includes('[dotenv@')) return;
  originalLog.apply(console, args);
};

require('dotenv').config({ path: envPath });

// Restore console.log
console.log = originalLog;

const errors = [];
const warnings = [];

// Critical validations
// Set NODE_ENV to production if not specified
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const criticalChecks = [
  {
    name: 'DATABASE_URL',
    check: () => process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://'),
    message: 'Must be a valid PostgreSQL connection string',
  },
  {
    name: 'JWT_SECRET',
    check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 64,
    message: 'Must be at least 64 characters',
  },
];

// Security validations
const securityChecks = [
  {
    name: 'JWT_SECRET strength',
    check: () => {
      const secret = process.env.JWT_SECRET || '';
      return !secret.includes('REPLACE') &&
             !secret.includes('CHANGE') &&
             !secret.includes('DEFAULT') &&
             secret.length >= 64;
    },
    message: 'JWT_SECRET contains placeholder text',
    level: 'error',
  },
  {
    name: 'SESSION_SECRET uniqueness',
    check: () => process.env.SESSION_SECRET !== process.env.JWT_SECRET,
    message: 'SESSION_SECRET must be different from JWT_SECRET',
    level: 'error',
  },
];

// Run validations
const runChecks = (checks) => {
  checks.forEach((validation) => {
    if (!validation.check()) {
      const item = { name: validation.name, message: validation.message };
      if (validation.level === 'warning') {
        warnings.push(item);
      } else {
        errors.push(item);
      }
    }
  });
};

runChecks(criticalChecks);
runChecks(securityChecks);

// Output only if there are issues
if (errors.length > 0) {
  console.error('[ENV] Validation errors:');
  errors.forEach(e => console.error(`  - ${e.name}: ${e.message}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('[ENV] Warnings:');
  warnings.forEach(w => console.warn(`  - ${w.name}: ${w.message}`));
}

// Silent success - only show a brief confirmation
console.log('[ENV] Configuration validated');
process.exit(0);
