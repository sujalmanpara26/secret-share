#!/usr/bin/env node
/**
 * encrypt.js — CLI for agent-side SecretShare link creation
 * 
 * Usage:
 *   node scripts/encrypt.js "your-secret-here"
 *   node scripts/encrypt.js "your-secret" "https://secrets.infinitycorp.tech"
 * 
 * Output:
 *   https://secrets.infinitycorp.tech/#v1:<base64url-blob>
 */

'use strict';

const crypto = require('crypto');

const secret = process.argv[2];
const baseUrl = process.argv[3] || 'https://secrets.infinitycorp.tech';

if (!secret) {
  console.error('Usage: node scripts/encrypt.js "your-secret" [base-url]');
  process.exit(1);
}

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function encrypt(plaintext) {
  // Generate IV (12 bytes) and key (32 bytes)
  const iv = crypto.randomBytes(12);
  const key = crypto.randomBytes(32);

  // Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(), // 16 bytes appended
  ]);

  // Blob: iv(12) + key(32) + ciphertext(n+16)
  const blob = Buffer.concat([iv, key, ciphertext]);
  const encoded = b64urlEncode(blob);

  return `${baseUrl}/#v1:${encoded}`;
}

encrypt(secret).then(url => {
  console.log(url);
}).catch(err => {
  console.error('Encryption failed:', err.message);
  process.exit(1);
});
