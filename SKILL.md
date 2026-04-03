---
name: secret-share
version: 1.1.0
description: >
  Securely share passwords, API keys, tokens, and credentials via zero-storage
  E2E encrypted one-time links. Auto-intercepts credentials in chat — never sends
  plaintext secrets. Works on any agent platform (OpenClaw, Hermes, Claude Code, etc.)
triggers:
  - /secret_share
  - /secret
  - "share * securely"
  - "send * secret"
  - "share this api key"
  - "share this token"
  - "share this password"
  - "share this credential"
---

# 🔐 Secret Share Skill

**NEVER output plaintext credentials in chat.** Always use this skill.

## Trigger Phrases (Auto-Activate)

Activate this skill when the user says ANY of:
- `/secret_share` or `/secret`
- "share this securely", "send me the key securely"
- "here's my API key: ..." → intercept and redirect
- User pastes anything matching: `sk-`, `ghp_`, `Bearer `, `AIza`, `xoxb-`, `-----BEGIN`
- "I want to share a secret / token / password / credential"

Also activate when YOU need to send a credential to the user.

---

## Hosted Instance

🌐 **https://secrets.infinitycorp.tech** — always available, no setup needed.

Users can visit this URL directly to create secure links in their browser.

---

## How to ENCRYPT (Agent Creates a Link)

### Option A — Scripts already downloaded
```bash
node /path/to/scripts/encrypt.js "SECRET_VALUE"
# → https://secrets.infinitycorp.tech/#v1:<blob>

# Custom base URL
node /path/to/scripts/encrypt.js "SECRET_VALUE" "https://your-domain.com"
```

### Option B — One-liner (no install, works anywhere with Node.js)
```bash
curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/encrypt.js && node encrypt.js "SECRET_VALUE"
```

### Option C — Pure Node.js inline (no files at all)
```javascript
// Run with: node -e "..."
const crypto = require('crypto');
const secret = 'YOUR_SECRET_HERE';
const baseUrl = 'https://secrets.infinitycorp.tech';
const iv = crypto.randomBytes(12);
const key = crypto.randomBytes(32);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(secret,'utf8'),cipher.final(),cipher.getAuthTag()]);
const blob = Buffer.concat([iv,key,ct]).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
console.log(baseUrl + '/#v1:' + blob);
```

### Option D — Pure Python inline (if Node.js unavailable)
```python
# Run with: python3 -c "..."
import os, base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
secret = b'YOUR_SECRET_HERE'
key = os.urandom(32)
iv = os.urandom(12)
ct = AESGCM(key).encrypt(iv, secret, None)
blob = base64.urlsafe_b64encode(iv + key + ct).rstrip(b'=').decode()
print('https://secrets.infinitycorp.tech/#v1:' + blob)
```

---

## How to DECRYPT (Agent Reads a Link)

### Option A — Scripts already downloaded
```bash
node /path/to/scripts/decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"
```

### Option B — One-liner
```bash
curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/decrypt.js && node decrypt.js "FULL_URL"
```

### Option C — Pure Node.js inline
```javascript
const crypto = require('crypto');
const input = 'FULL_URL_OR_BLOB_HERE';
const encoded = (input.match(/#v1:(.+)$/) || [,''])[1] || input.trim();
function b64d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Buffer.from(s,'base64')}
const blob = b64d(encoded);
const [iv,key,ctTag] = [blob.slice(0,12),blob.slice(12,44),blob.slice(44)];
const [ct,tag] = [ctTag.slice(0,-16),ctTag.slice(-16)];
const d = crypto.createDecipheriv('aes-256-gcm',key,iv);
d.setAuthTag(tag);
console.log(Buffer.concat([d.update(ct),d.final()]).toString('utf8'));
```

---

## How It Works

```
Secret → AES-256-GCM encrypt
       → IV(12) + Key(32) + Ciphertext embedded in URL fragment (#v1:...)
       → Fragment NEVER sent to server (browser/client only)
       → Server only sees: GET /
       → Recipient opens URL → decrypts in browser
```

**Security guarantees:**
- ✅ Plaintext never in chat history
- ✅ Plaintext never on server
- ✅ Key lives only in URL fragment
- ✅ AES-256-GCM — tamper detection built in
- ✅ Zero npm dependencies — Node.js built-in `crypto` only

---

## Response Templates

### When user shares a secure link with you:
Decrypt it silently using Option C above, then use the secret for the task. Do NOT echo the decrypted value back in chat unless explicitly asked.

### When YOU need to send a credential to the user:
> 🔐 Here's your [API key / token / password] as a secure link — opens and decrypts in your browser, never stored on any server:
> `https://secrets.infinitycorp.tech/#v1:...`

### When user types a credential in plaintext:
> ⚠️ Don't send that here — chat history isn't secure for credentials.
> Go to **https://secrets.infinitycorp.tech**, paste it there, and send me the link instead. I'll decrypt it on my end.

### When user types `/secret_share` or `/secret`:
> 🔐 **Secure Secret Share**
> 1. Go to 👉 https://secrets.infinitycorp.tech
> 2. Paste your secret there → click Create
> 3. Send me the generated link
>
> I'll decrypt it on my end — plaintext never touches this chat.

---

## Installation

### OpenClaw
```bash
# Place this file at:
~/.openclaw/skills/secret-share/SKILL.md
```

### Hermes Agent
```bash
# Place this file at:
~/.hermes/skills/secret-share/SKILL.md
```

### Any other agent
Place `SKILL.md` in your agent's skills directory. The skill uses no agent-specific APIs — just shell/Node.js commands.

---

## Repo

📦 https://github.com/sujalmanpara26/secret-share
