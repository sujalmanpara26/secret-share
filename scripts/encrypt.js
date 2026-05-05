#!/usr/bin/env node
/**
 * encrypt.js — CLI for SecretShare link creation
 *
 * Usage:
 *   node encrypt.js "your-secret-here"
 *   node encrypt.js "your-secret" "https://your-domain.com"
 *   node encrypt.js "your-secret" --onetime                    # One-time link (server-stored)
 *   node encrypt.js "your-secret" --onetime --ttl 30           # Expires in 30 minutes
 *   node encrypt.js "your-secret" --onetime --label "GitHub"   # With label
 *
 * Flags:
 *   --onetime          Store on server, return one-time link (auto-deletes after first read)
 *   --ttl MINUTES      Expiry for one-time links (default: 60)
 *   --label NAME       Optional label for one-time links
 *   --server URL       Server URL for one-time mode (default: base URL)
 *
 * No dependencies — uses Node.js built-in crypto only.
 */

'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');

// ── Parse args ──────────────────────────────────────
const args = process.argv.slice(2);
let secret = null;
let baseUrl = 'https://secrets.infinitycorp.tech';
let oneTime = false;
let ttl = 60;
let label = null;
let serverUrl = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--onetime') {
    oneTime = true;
  } else if (arg === '--ttl' && i + 1 < args.length) {
    ttl = parseInt(args[++i], 10);
    if (isNaN(ttl) || ttl < 1) {
      console.error('Error: --ttl must be a positive number (minutes)');
      process.exit(1);
    }
  } else if (arg === '--label' && i + 1 < args.length) {
    label = args[++i];
  } else if (arg === '--server' && i + 1 < args.length) {
    serverUrl = args[++i].replace(/\/$/, '');
  } else if (!arg.startsWith('--') && !secret) {
    secret = arg;
  } else if (!arg.startsWith('--') && secret && !serverUrl) {
    // Legacy: second positional arg is base URL
    baseUrl = arg.replace(/\/$/, '');
  }
}

if (!secret) {
  console.error('Usage: node encrypt.js "your-secret" [base-url] [options]');
  console.error('');
  console.error('Options:');
  console.error('  --onetime          Create a one-time link (server-stored, auto-deletes)');
  console.error('  --ttl MINUTES      Expiry for one-time links (default: 60)');
  console.error('  --label NAME       Optional label for one-time links');
  console.error('  --server URL       Server URL for one-time storage');
  console.error('');
  console.error('Examples:');
  console.error('  node encrypt.js "sk-abc123"');
  console.error('  node encrypt.js "sk-abc123" "https://my-server.com"');
  console.error('  node encrypt.js "sk-abc123" --onetime --ttl 30');
  process.exit(1);
}

// ── Crypto ──────────────────────────────────────────
function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const key = crypto.randomBytes(32);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // Blob layout: iv(12) + key(32) + ciphertext(n) + tag(16)
  const blob = Buffer.concat([iv, key, ciphertext]);
  return b64urlEncode(blob);
}

// ── One-time link creation ──────────────────────────
function postOneTimeSecret(serverBase, blob, ttlMinutes, secretLabel) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/secrets', serverBase);
    const body = JSON.stringify({
      blob,
      ttl: ttlMinutes,
      label: secretLabel || undefined,
    });

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error('Rate limited — try again in a minute.'));
          return;
        }
        if (res.statusCode !== 201) {
          reject(new Error(`Server returned ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid server response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────
async function main() {
  try {
    const encoded = encrypt(secret);

    if (oneTime) {
      const server = serverUrl || baseUrl;
      const result = await postOneTimeSecret(server, encoded, ttl, label);
      console.log(result.url);
      if (result.expiresAt) {
        const mins = Math.round((new Date(result.expiresAt) - Date.now()) / 60000);
        console.error(`⏱️  One-time link · expires in ${mins}m · auto-deletes after first read`);
      }
    } else {
      console.log(`${baseUrl}/#v1:${encoded}`);
    }
  } catch (err) {
    console.error('Encryption failed:', err.message);
    process.exit(1);
  }
}

main();
