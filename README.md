# 🔐 SecretShare

Zero-knowledge, E2E encrypted secret sharing — built for AI agents.

## The Problem

AI coding agents (Codex, Claude Code, OpenCode) refuse plaintext secrets in chat. Their safety layers detect patterns like `ghp_`, `sk-`, `AKIA` and block them. You waste time and tokens fighting the model's security refusal.

## The Solution

Encrypt your secret → get a URL → share the URL → agent decrypts via CLI.

The secret only exists in the agent's tool execution output — never in the conversation history. No pattern triggers, no refusals, no wasted tokens.

```
Secret → AES-256-GCM encrypt
       → Key embedded in URL fragment (#) or stored as one-time link
       → Fragment NEVER sent to server
       → Agent runs: node decrypt.js "URL" --env GH_TOKEN
       → Secret written directly to .env — never touches chat
```

## Two Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| **Encrypted Link** | Key lives in URL fragment (`#v1:...`). Server never sees it. Link works forever. | Sharing with local agents |
| **One-Time Link** | Encrypted blob stored on server. Auto-deletes after first read. Expires after TTL. | Sharing with remote/cloud agents |

---

## Quick Start

### Create a Secure Link

```bash
# Fragment link (no server needed)
node scripts/encrypt.js "your-secret-here"
# → https://secrets.infinitycorp.tech/#v1:<blob>

# One-time link (auto-deletes after first read)
node scripts/encrypt.js "your-secret" --onetime --ttl 30
# → https://your-server.com/s/abc123
```

### Decrypt a Secure Link

```bash
# Print to stdout
node scripts/decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"

# Write directly to .env file
node scripts/decrypt.js "URL" --env GH_TOKEN

# Write to specific env file, silent mode
node scripts/decrypt.js "URL" --env API_KEY --env-file .env.local --silent

# Output as shell export
node scripts/decrypt.js "URL" --env MY_TOKEN --export
# → export MY_TOKEN='value'

# JSON output
node scripts/decrypt.js "URL" --json
# → {"value":"...","length":42}
```

### No-Install One-Liners

```bash
# Encrypt (works anywhere with Node.js)
node -e "
const c=require('crypto'),s=process.argv[1],b='https://secrets.infinitycorp.tech';
const iv=c.randomBytes(12),k=c.randomBytes(32),ci=c.createCipheriv('aes-256-gcm',k,iv);
const ct=Buffer.concat([ci.update(s,'utf8'),ci.final(),ci.getAuthTag()]);
const blob=Buffer.concat([iv,k,ct]).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
console.log(b+'/#v1:'+blob);
" "YOUR_SECRET"

# Decrypt
node -e "
const c=require('crypto'),input=process.argv[1];
const enc=(input.match(/#v1:(.+)$/)||[,''])[1].trim();
function d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Buffer.from(s,'base64')}
const b=d(enc),iv=b.slice(0,12),k=b.slice(12,44),ct=b.slice(44,-16),tag=b.slice(-16);
const di=c.createDecipheriv('aes-256-gcm',k,iv);di.setAuthTag(tag);
console.log(Buffer.concat([di.update(ct),di.final()]).toString('utf8'));
" "PASTE_URL_HERE"
```

---

## CLI Reference

### encrypt.js

```
node scripts/encrypt.js "secret" [base-url] [options]

Options:
  --onetime          Store on server, return one-time link
  --ttl MINUTES      Expiry for one-time links (default: 60, max: 1440)
  --label NAME       Optional label for one-time links
  --server URL       Server URL for one-time storage
```

### decrypt.js

```
node scripts/decrypt.js "url-or-blob" [options]

Options:
  --env VAR_NAME     Write VAR_NAME=value to .env file
  --env-file PATH    Env file path (default: .env in cwd)
  --export           Output: export VAR_NAME=value (requires --env)
  --json             Output as JSON
  --silent           No stdout (use with --env)
```

---

## Self-Host

```bash
git clone https://github.com/sujalmanpara26/secret-share.git
cd secret-share
npm install
node serve.js
# → http://localhost:4321
```

### With systemd

```bash
cp secret-share.service /etc/systemd/system/
systemctl enable --now secret-share
```

### Server API (for one-time links)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/secrets` | POST | Store encrypted blob. Body: `{blob, ttl, label}`. Returns `{id, url, expiresAt}` |
| `/api/secrets/:id` | GET | Fetch + delete (one-time). Returns `{blob, label, createdAt}` |
| `/api/secrets/:id/peek` | GET | Check existence without consuming. Returns `{exists, label, expiresAt}` |
| `/health` | GET | Health check |

Rate limit: 100 creates per hour per IP. Max blob size: 64KB. TTL: 1–1440 minutes.

---

## Agent Integration

See [SKILL.md](SKILL.md) for AI agent integration instructions. Drop it into any agent's skill directory and it'll know how to handle secrets.

**Why this beats alternatives:**

| Tool | Setup | Works remotely? | Universal? |
|------|-------|----------------|-----------|
| .env files | None | ❌ No | ✅ |
| OpenPass | MCP server | ❌ No | ❌ |
| HashiCorp Vault | Enterprise infra | ✅ Yes | ❌ |
| **SecretShare** | **None** | **✅ Yes** | **✅ Yes** |

---

## Security

- **AES-256-GCM** — authenticated encryption with tamper detection
- **Key in URL fragment** — browsers never send fragments to servers
- **Zero dependencies** — Node.js built-in `crypto` only
- **One-time links** — auto-delete after first read, expire after TTL
- **Rate limiting** — 100 creates/hour per IP
- **No logs** — server never sees plaintext, one-time blobs are deleted

### What this is NOT

This is not a vault or password manager. The security model is: **whoever has the URL can decrypt**. For fragment links, the URL IS the password. For one-time links, the URL works exactly once. Use this for ephemeral secret sharing, not long-term storage.

---

## Files

```
├── public/
│   └── index.html        ← Web UI (create + decrypt)
├── scripts/
│   ├── encrypt.js        ← CLI: create secure links
│   └── decrypt.js        ← CLI: decrypt secure links
├── data/                  ← One-time secrets storage (gitignored)
├── serve.js              ← Server with API
├── SKILL.md              ← AI agent integration
├── package.json
├── secret-share.service  ← systemd unit
└── .gitignore
```

## Public Instance

🌐 **https://secrets.infinitycorp.tech**

---

## License

MIT — Sujal Manpara
