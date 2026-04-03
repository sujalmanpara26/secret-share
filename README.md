# 🔐 Secret Share

Zero-knowledge, E2E encrypted secret sharing. Share passwords, API keys, and credentials securely — the server **never** sees your plaintext.

## How It Works

```
Secret → AES-256-GCM encrypt (browser/CLI)
       → Key embedded in URL fragment (#)
       → Fragment NEVER sent to server
       → Server only sees: GET /
       → Recipient opens URL → decrypts in their browser
```

## Security Guarantees

- ✅ Plaintext never in chat history
- ✅ Plaintext never on server
- ✅ Key lives only in URL fragment (client-side only)
- ✅ AES-256-GCM — tamper detection built in
- ✅ Zero dependencies — Node.js built-in `crypto` only

---

## Quick Start (Server)

```bash
git clone https://github.com/sujalmanpara26/secret-share.git
cd secret-share
npm install
node serve.js
# Server runs on http://localhost:4321
```

---

## CLI Usage (No Install Needed)

### Encrypt — Create a secure link

```bash
# Using hosted instance
node scripts/encrypt.js "your-secret-here"
# → https://secrets.infinitycorp.tech/#v1:<blob>

# Using your own server
node scripts/encrypt.js "your-secret-here" "https://your-domain.com"
# → https://your-domain.com/#v1:<blob>
```

### Decrypt — Read a secure link

```bash
# Full URL
node scripts/decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"

# Or just the blob part
node scripts/decrypt.js "<blob>"
```

### One-liner (no clone needed)

```bash
# Encrypt
curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/encrypt.js && node encrypt.js "your-secret"

# Decrypt
curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/decrypt.js && node decrypt.js "https://secrets.infinitycorp.tech/#v1:<blob>"
```

---

## Agent / AI Usage (SKILL.md)

For AI agents, add this to your SKILL.md:

```markdown
## Secret Share — Secure Credential Exchange

To ENCRYPT (create a secure link):
  node /path/to/scripts/encrypt.js "SECRET_VALUE"
  OR: curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/encrypt.js && node encrypt.js "SECRET_VALUE"

To DECRYPT (read a secure link):
  node /path/to/scripts/decrypt.js "FULL_URL_OR_BLOB"
  OR: curl -sO https://raw.githubusercontent.com/sujalmanpara26/secret-share/main/scripts/decrypt.js && node decrypt.js "URL"

No npm install needed. Uses Node.js built-in crypto only.
```

---

## Files

```
├── public/
│   ├── index.html       ← Full SPA (create + view secrets)
│   └── vault.html       ← Vault page
├── scripts/
│   ├── encrypt.js       ← CLI: create secure links (no deps)
│   └── decrypt.js       ← CLI: decrypt secure links (no deps)
├── serve.js             ← Node.js static server
├── package.json
└── secret-share.service ← systemd service (optional)
```

---

## Deploy with systemd (Linux)

```bash
cp secret-share.service /etc/systemd/system/
systemctl enable secret-share
systemctl start secret-share
```

---

## Public Instance

🌐 **https://secrets.infinitycorp.tech** — use this if you don't want to self-host.

---

## License

MIT
