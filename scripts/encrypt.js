#!/usr/bin/env node
/**
 * encrypt.js — CLI for SecretShare link creation
 *
 * Usage:
 *   node encrypt.js "your-secret-here"
 *   node encrypt.js "your-secret" "https://your-domain.com"
 *
 * Output:
 *   https://your-domain.com/#v1:<base64url-blob>
 *
 * No dependencies — uses Node.js built-in crypto only.
 * Works standalone: node encrypt.js "secret" (no install needed)
 */

'use strict';

const crypto = require('crypto');

const secret = process.argv[2];
const baseUrl = (process.argv[3] || 'https://secrets.infinitycorp.tech').replace(/\/$/, '');

if (!secret) {
  console.error('Usage: node encrypt.js "your-secret" [base-url]');
  console.error('Example: node encrypt.js "sk-abc123"');
  console.error('Example: node encrypt.js "sk-abc123" "https://secrets.infinitycorp.tech"');
  process.exit(1);
}

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
  const encoded = b64urlEncode(blob);

  return `${baseUrl}/#v1:${encoded}`;
}

try {
  const url = encrypt(secret);
  console.log(url);
} catch (err) {
  console.error('Encryption failed:', err.message);
  process.exit(1);
}
