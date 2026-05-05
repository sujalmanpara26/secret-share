#!/usr/bin/env node
/**
 * serve.js — SecretShare server
 * Serves the web UI + one-time secret API.
 * Never processes encryption — just stores/serves blobs.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const HTML_FILE = path.join(PUBLIC_DIR, 'index.html');

// Max blob size: 64KB (way more than any API key/token)
const MAX_BLOB_SIZE = 64 * 1024;
// Rate limit: 100 creates per hour per IP
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// ── Init ────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── HTML Cache ──────────────────────────────────────
let cachedHtml = null;

function getHtml() {
  if (!cachedHtml) {
    cachedHtml = fs.readFileSync(HTML_FILE, 'utf8');
  }
  return cachedHtml;
}

if (process.env.NODE_ENV !== 'production') {
  fs.watch(HTML_FILE, () => {
    cachedHtml = null;
    console.log('[dev] HTML reloaded');
  });
}

// ── Rate Limiter ────────────────────────────────────
const rateBuckets = new Map(); // ip → { count, resetAt }

function checkRate(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT_MAX;
}

// Clean rate buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Secret Storage ──────────────────────────────────
function generateId() {
  return crypto.randomBytes(12).toString('base64url');
}

function secretPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function storeSecret(blob, ttlMinutes, label) {
  const id = generateId();
  const now = Date.now();
  const expiresAt = now + (ttlMinutes || 60) * 60 * 1000;

  const record = {
    id,
    blob,
    label: label || null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };

  fs.writeFileSync(secretPath(id), JSON.stringify(record), 'utf8');
  return record;
}

function fetchSecret(id) {
  const fp = secretPath(id);
  if (!fs.existsSync(fp)) return null;

  const record = JSON.parse(fs.readFileSync(fp, 'utf8'));

  // Check expiry
  if (new Date(record.expiresAt) < new Date()) {
    fs.unlinkSync(fp);
    return null;
  }

  return record;
}

function consumeSecret(id) {
  const record = fetchSecret(id);
  if (!record) return null;

  // Delete after read (one-time)
  const fp = secretPath(id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  return record;
}

function peekSecret(id) {
  const record = fetchSecret(id);
  if (!record) return null;
  return {
    exists: true,
    label: record.label,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

// Clean expired secrets every 5 minutes
setInterval(() => {
  if (!fs.existsSync(DATA_DIR)) return;
  const now = new Date();
  let cleaned = 0;

  for (const file of fs.readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const fp = path.join(DATA_DIR, file);
      const record = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (new Date(record.expiresAt) < now) {
        fs.unlinkSync(fp);
        cleaned++;
      }
    } catch { /* skip corrupt files */ }
  }

  if (cleaned > 0) console.log(`[cleanup] Removed ${cleaned} expired secret(s)`);
}, 5 * 60 * 1000);

// ── HTTP Helpers ────────────────────────────────────
function readBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || '0.0.0.0';
}

// ── Server ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── Health check ──
  if (pathname === '/health') {
    json(res, 200, { ok: true, service: 'secret-share', version: '3.0.0', ts: Date.now() });
    return;
  }

  // ── API: Create one-time secret ──
  if (pathname === '/api/secrets' && req.method === 'POST') {
    const ip = getClientIp(req);
    if (!checkRate(ip)) {
      json(res, 429, { error: 'Rate limited. Max 100 secrets per hour.' });
      return;
    }

    try {
      const raw = await readBody(req, MAX_BLOB_SIZE);
      const data = JSON.parse(raw);

      if (!data.blob || typeof data.blob !== 'string') {
        json(res, 400, { error: 'Missing or invalid blob' });
        return;
      }

      if (data.blob.length > MAX_BLOB_SIZE) {
        json(res, 400, { error: 'Blob too large (max 64KB)' });
        return;
      }

      const ttl = Math.min(Math.max(parseInt(data.ttl) || 60, 1), 1440); // 1 min to 24 hours
      const record = storeSecret(data.blob, ttl, data.label);

      const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || `localhost:${PORT}`}`;

      json(res, 201, {
        id: record.id,
        url: `${baseUrl}/s/${record.id}`,
        expiresAt: record.expiresAt,
        label: record.label,
      });
    } catch (err) {
      json(res, 400, { error: err.message });
    }
    return;
  }

  // ── API: Fetch (consume) one-time secret ──
  const fetchMatch = pathname.match(/^\/api\/secrets\/([a-zA-Z0-9_-]+)$/);
  if (fetchMatch && req.method === 'GET') {
    const id = fetchMatch[1];
    const record = consumeSecret(id);

    if (!record) {
      // Check if it existed but was already consumed
      json(res, 404, { error: 'Secret not found — expired or already viewed.' });
      return;
    }

    json(res, 200, {
      blob: record.blob,
      label: record.label,
      createdAt: record.createdAt,
    });
    return;
  }

  // ── API: Peek (check without consuming) ──
  const peekMatch = pathname.match(/^\/api\/secrets\/([a-zA-Z0-9_-]+)\/peek$/);
  if (peekMatch && req.method === 'GET') {
    const id = peekMatch[1];
    const info = peekSecret(id);

    if (!info) {
      json(res, 404, { error: 'Secret not found.' });
      return;
    }

    json(res, 200, info);
    return;
  }

  // ── Short URL: /s/:id → serve HTML (browser decrypts) ──
  const shortMatch = pathname.match(/^\/s\/([a-zA-Z0-9_-]+)$/);
  if (shortMatch) {
    try {
      const html = getHtml();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
    return;
  }

  // ── Static HTML (main page) ──
  try {
    const html = getHtml();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        "connect-src 'self'",
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
  console.log(`[secret-share] v3.0.0 listening on http://${HOST}:${PORT}`);
  console.log(`[secret-share] Data dir: ${DATA_DIR}`);
});

server.on('error', (err) => {
  console.error('[secret-share] Server error:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[secret-share] Shutting down...');
  server.close(() => process.exit(0));
});
