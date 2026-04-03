#!/usr/bin/env node
/**
 * decrypt.js — CLI for SecretShare link decryption
 *
 * Usage:
 *   node decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"
 *   node decrypt.js "<blob-only>"
 *
 * No dependencies — uses Node.js built-in crypto only.
 */

'use strict';

const crypto = require('crypto');

const input = process.argv[2];

if (!input) {
  console.error('Usage: node decrypt.js "<full-url-or-blob>"');
  console.error('Example: node decrypt.js "https://secrets.infinitycorp.tech/#v1:abc123..."');
  process.exit(1);
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function decrypt(input) {
  // Extract blob from full URL or use directly
  let encoded = input;
  const match = input.match(/#v1:(.+)$/);
  if (match) {
    encoded = match[1];
  } else if (input.includes('#v1:')) {
    encoded = input.split('#v1:')[1];
  }

  // Strip any trailing whitespace
  encoded = encoded.trim();

  const blob = b64urlDecode(encoded);

  if (blob.length < 12 + 32 + 16) {
    throw new Error('Invalid blob: too short');
  }

  const iv = blob.slice(0, 12);
  const key = blob.slice(12, 44);
  const ciphertextWithTag = blob.slice(44);
  const ciphertext = ciphertextWithTag.slice(0, -16);
  const tag = ciphertextWithTag.slice(-16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

try {
  const plaintext = decrypt(input);
  console.log(plaintext);
} catch (err) {
  console.error('Decryption failed:', err.message);
  process.exit(1);
}
