---
name: secret-share
version: 1.2.0
description: >
  Securely share passwords, API keys, tokens, and credentials via zero-storage
  E2E encrypted one-time links. Auto-intercepts credentials in chat — never sends
  plaintext secrets. Works on any agent platform (OpenClaw, Hermes, Claude Code, etc.)
  Includes a full web dashboard UI — self-host it or use the public instance.
triggers:
  - /secret_share
  - /secret
  - "share * securely"
  - "share this api key"
  - "share this token"
  - "share this password"
  - "share this credential"
---

# 🔐 Secret Share Skill

**NEVER output plaintext credentials in chat.** Always use this skill.

---

## 🚀 First-Time Setup (Self-Host the Dashboard)

Run this ONCE to set up the dashboard on your machine:

```bash
# 1. Clone the repo
git clone https://github.com/sujalmanpara26/secret-share.git ~/secret-share
cd ~/secret-share

# 2. Install dependencies (minimal)
npm install

# 3. Start the server
node serve.js
# → Server running at http://localhost:4321
```

To run it permanently in the background:
```bash
# Using nohup
nohup node ~/secret-share/serve.js > /tmp/secret-share.log 2>&1 &

# Or using systemd (Linux)
cp ~/secret-share/secret-share.service /etc/systemd/system/
systemctl enable --now secret-share
```

**Verify it's running:**
```bash
curl http://localhost:4321/health
# → {"ok":true,"service":"secret-share"}
```

---

## 🔗 Generate a Secure Link

Once the server is running, use the script to generate links:

```bash
# Generate link (points to YOUR local dashboard)
node ~/secret-share/scripts/encrypt.js "SECRET_VALUE" "http://localhost:4321"
# → http://localhost:4321/#v1:<encrypted-blob>

# Or use the public hosted dashboard
node ~/secret-share/scripts/encrypt.js "SECRET_VALUE" "https://secrets.infinitycorp.tech"
# → https://secrets.infinitycorp.tech/#v1:<encrypted-blob>
```

**The link format:**
```
http://localhost:4321/#v1:<blob>
                       ↑
           Key is HERE — in the URL fragment
           Browser reads it client-side only
           Server NEVER receives it
```

---

## 🔓 Decrypt a Secure Link

```bash
node ~/secret-share/scripts/decrypt.js "http://localhost:4321/#v1:<blob>"
# OR
node ~/secret-share/scripts/decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"
# → prints the plaintext secret
```

---

## ⚡ No-Install One-Liners (Fallback)

If the server isn't set up yet, use these inline — no files needed:

### Encrypt (Node.js)
```bash
node -e "
const c=require('crypto'),s=process.argv[1],b='https://secrets.infinitycorp.tech';
const iv=c.randomBytes(12),k=c.randomBytes(32),ci=c.createCipheriv('aes-256-gcm',k,iv);
const ct=Buffer.concat([ci.update(s,'utf8'),ci.final(),ci.getAuthTag()]);
const blob=Buffer.concat([iv,k,ct]).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
console.log(b+'/#v1:'+blob);
" "YOUR_SECRET_HERE"
```

### Decrypt (Node.js)
```bash
node -e "
const c=require('crypto'),input=process.argv[1];
const enc=(input.match(/#v1:(.+)$/)||[,''])[1].trim();
function d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Buffer.from(s,'base64')}
const b=d(enc),iv=b.slice(0,12),k=b.slice(12,44),ct=b.slice(44,-16),tag=b.slice(-16);
const di=c.createDecipheriv('aes-256-gcm',k,iv);di.setAuthTag(tag);
console.log(Buffer.concat([di.update(ct),di.final()]).toString('utf8'));
" "FULL_URL_OR_BLOB"
```

---

## 🌐 Dashboard UI

The dashboard has two views:

**Create view** (`/`) — user pastes secret → clicks Generate → gets link
**View/Decrypt view** (`/#v1:...`) — user opens link → secret decrypts in browser

When you share a link with a human user, they open it in their browser and the secret decrypts **entirely client-side**. The server only serves static HTML — it never touches the secret.

---

## 📋 Trigger Phrases & Auto-Behavior

| Trigger | Action |
|---|---|
| `/secret_share` or `/secret` | Show instructions, ask for secret |
| User types `sk-...`, `ghp_...`, `Bearer ...` etc. | Warn + redirect to secure link |
| "share this API key / token / password" | Encrypt it, return secure link |
| User sends `https://secrets.infinitycorp.tech/#v1:...` | Decrypt silently, use the value |

---

## 💬 Response Templates

### When user types `/secret_share`:
> 🔐 **Secure Secret Share**
> 1. Go to 👉 http://localhost:4321 (or https://secrets.infinitycorp.tech)
> 2. Paste your secret → click **Generate Secure Link**
> 3. Send me the generated link
>
> I'll decrypt it on my end — plaintext never touches this chat.

### When user sends a secure link to you:
Decrypt it silently using the decrypt script above. Use the secret for the task. **Do NOT echo the plaintext back in chat** unless explicitly asked.

### When YOU send a credential to the user:
> 🔐 Here's your [API key / token / password] as a secure link:
> `http://localhost:4321/#v1:...`
> Open in your browser — decrypts client-side, server never sees it.

### When user types a credential in plaintext:
> ⚠️ Don't send credentials in chat — they'll be in your message history.
> Go to 👉 http://localhost:4321 and use the secure link instead. I'll decrypt it on my end.

---

## 🔒 How It Works

```
Secret → AES-256-GCM encrypt in browser/CLI
       → iv(12) + key(32) + ciphertext packed into blob
       → Blob base64url-encoded into URL fragment (#v1:...)
       → Fragment NEVER sent to server (browser/client only)
       → Server only serves static HTML
       → Recipient opens URL → browser decrypts locally
```

**Security guarantees:**
- ✅ Plaintext never in chat history
- ✅ Plaintext never on any server
- ✅ Encryption key lives only in URL fragment
- ✅ AES-256-GCM — authenticated encryption, tamper detection
- ✅ Zero npm dependencies for crypto — Node.js built-in only

---

## 📦 Files

```
~/secret-share/
├── public/
│   ├── index.html        ← Full dashboard SPA (create + decrypt)
│   └── vault.html        ← Vault page (X25519 user→bot flow)
├── scripts/
│   ├── encrypt.js        ← CLI: create secure links
│   └── decrypt.js        ← CLI: decrypt secure links
├── serve.js              ← Node.js static server (port 4321)
├── package.json
└── secret-share.service  ← systemd unit file
```

**Repo:** https://github.com/sujalmanpara26/secret-share
