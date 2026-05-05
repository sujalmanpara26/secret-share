#!/usr/bin/env node
/**
 * decrypt.js — CLI for SecretShare link decryption
 *
 * Usage:
 *   node decrypt.js "<full-url-or-blob>"
 *   node decrypt.js "<url>" --env GH_TOKEN              # Write to .env
 *   node decrypt.js "<url>" --env GH_TOKEN --env-file .env.local
 *   node decrypt.js "<url>" --env GH_TOKEN --export     # Output: export GH_TOKEN=value
 *   node decrypt.js "<url>" --json                      # Output: {"value":"...","length":N}
 *   node decrypt.js "<url>" --silent                    # No stdout (use with --env)
 *
 * Flags:
 *   --env VAR_NAME     Write decrypted value as VAR_NAME=value to .env file
 *   --env-file PATH    Specify env file path (default: .env in cwd)
 *   --export           Output as: export VAR_NAME=value (requires --env)
 *   --json             Output as JSON: {"value":"...","length":N}
 *   --silent           Suppress stdout output (useful with --env)
 *
 * No dependencies — uses Node.js built-in crypto only.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ── Parse args ──────────────────────────────────────
const args = process.argv.slice(2);
let input = null;
let envVar = null;
let envFile = '.env';
let exportMode = false;
let jsonMode = false;
let silentMode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--env' && i + 1 < args.length) {
    envVar = args[++i];
  } else if (arg === '--env-file' && i + 1 < args.length) {
    envFile = args[++i];
  } else if (arg === '--export') {
    exportMode = true;
  } else if (arg === '--json') {
    jsonMode = true;
  } else if (arg === '--silent') {
    silentMode = true;
  } else if (!arg.startsWith('--') && !input) {
    input = arg;
  }
}

if (!input) {
  console.error('Usage: node decrypt.js "<full-url-or-blob>" [options]');
  console.error('');
  console.error('Options:');
  console.error('  --env VAR_NAME     Write to .env as VAR_NAME=value');
  console.error('  --env-file PATH    Env file path (default: .env)');
  console.error('  --export           Output: export VAR_NAME=value');
  console.error('  --json             Output as JSON');
  console.error('  --silent           No stdout (use with --env)');
  console.error('');
  console.error('Examples:');
  console.error('  node decrypt.js "https://secrets.infinitycorp.tech/#v1:abc..."');
  console.error('  node decrypt.js "URL" --env GH_TOKEN');
  console.error('  node decrypt.js "URL" --env API_KEY --env-file .env.local --silent');
  process.exit(1);
}

if (exportMode && !envVar) {
  console.error('Error: --export requires --env VAR_NAME');
  process.exit(1);
}

// ── Crypto helpers ──────────────────────────────────
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function decryptBlob(encoded) {
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

// ── Env file helpers ────────────────────────────────
function writeToEnvFile(filePath, varName, value) {
  const absPath = path.resolve(filePath);
  let content = '';

  if (fs.existsSync(absPath)) {
    content = fs.readFileSync(absPath, 'utf8');
    // Replace existing var or append
    const regex = new RegExp(`^${escapeRegex(varName)}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${varName}=${value}`);
    } else {
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
      content += `${varName}=${value}\n`;
    }
  } else {
    content = `${varName}=${value}\n`;
  }

  fs.writeFileSync(absPath, content, 'utf8');
  return absPath;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Output helpers ──────────────────────────────────
function output(plaintext) {
  // Write to env file if requested
  if (envVar) {
    const absPath = writeToEnvFile(envFile, envVar, plaintext);
    if (!silentMode && !jsonMode && !exportMode) {
      console.error(`✅ Written ${envVar} to ${absPath}`);
    }
  }

  // Determine output format
  if (jsonMode) {
    console.log(JSON.stringify({ value: plaintext, length: plaintext.length }));
  } else if (exportMode) {
    // Shell-safe: wrap in single quotes, escape existing single quotes
    const escaped = plaintext.replace(/'/g, "'\\''");
    console.log(`export ${envVar}='${escaped}'`);
  } else if (!silentMode) {
    console.log(plaintext);
  }
}

// ── One-time link fetcher ───────────────────────────
function fetchOneTimeSecret(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 410) {
        reject(new Error('This one-time link has already been used.'));
        return;
      }
      if (res.statusCode === 404) {
        reject(new Error('Secret not found — it may have expired.'));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Server returned ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.blob);
        } catch {
          reject(new Error('Invalid server response'));
        }
      });
    }).on('error', reject);
  });
}

// ── Main ────────────────────────────────────────────
async function main() {
  try {
    let plaintext;

    // Check if it's a one-time link (/s/ path)
    const oneTimeMatch = input.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (oneTimeMatch) {
      // Fetch from server, then decrypt the blob
      const apiUrl = input.replace(/\/s\/[a-zA-Z0-9_-]+$/, `/api/secrets/${oneTimeMatch[1]}`);
      const blob = await fetchOneTimeSecret(apiUrl);
      plaintext = decryptBlob(blob);
    } else {
      // Standard fragment-based decryption
      let encoded = input;
      const match = input.match(/#v1:(.+)$/);
      if (match) {
        encoded = match[1];
      } else if (input.includes('#v1:')) {
        encoded = input.split('#v1:')[1];
      }
      plaintext = decryptBlob(encoded);
    }

    output(plaintext);
  } catch (err) {
    console.error('Decryption failed:', err.message);
    process.exit(1);
  }
}

main();
