#!/usr/bin/env node
/**
 * serve.js — Minimal static server for SecretShare
 * Serves public/index.html on port 4321, localhost only.
 * Never processes secrets — just serves the HTML.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

const HTML_FILE = path.join(PUBLIC_DIR, 'index.html');
const VAULT_FILE = path.join(PUBLIC_DIR, 'vault.html');

// Cache HTML files in memory
let cachedHtml = null;
let cachedVault = null;

function getHtml() {
  if (!cachedHtml) {
    cachedHtml = fs.readFileSync(HTML_FILE, 'utf8');
  }
  return cachedHtml;
}

function getVaultHtml() {
  if (!cachedVault) {
    cachedVault = fs.readFileSync(VAULT_FILE, 'utf8');
  }
  return cachedVault;
}

// Watch for file changes in dev mode
if (process.env.NODE_ENV !== 'production') {
  fs.watch(HTML_FILE, () => {
    cachedHtml = null;
    console.log('[dev] HTML reloaded');
  });
  fs.watch(VAULT_FILE, () => {
    cachedVault = null;
    console.log('[dev] Vault HTML reloaded');
  });
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'secret-share', ts: Date.now() }));
    return;
  }

  // Route /vault/* to vault SPA
  const isVault = req.url.startsWith('/vault');

  try {
    const html = isVault ? getVaultHtml() : getHtml();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        isVault ? "connect-src 'self'" : "connect-src 'none'",
        "img-src 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
    console.error('[error]', err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[secret-share] Listening on http://${HOST}:${PORT}`);
  console.log(`[secret-share] Public dir: ${PUBLIC_DIR}`);
});

server.on('error', (err) => {
  console.error('[secret-share] Server error:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[secret-share] Shutting down...');
  server.close(() => process.exit(0));
});
