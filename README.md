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
- ✅ Zero dependencies, works in any browser

## Quick Start

```bash
git clone https://github.com/sujalmanpara26/secret-share.git
cd secret-share
npm install
node serve.js
```

Server runs on `http://localhost:4321`

## CLI Usage

```bash
# Create a secure link from terminal
node scripts/encrypt.js "your-secret-here"
# Output: http://localhost:4321/#v1:<encrypted-blob>
```

## Files

```
├── public/
│   ├── index.html       ← Full SPA (create + view secrets)
│   └── vault.html       ← Vault page
├── scripts/
│   └── encrypt.js       ← CLI encryption tool
├── serve.js             ← Node.js static server
├── package.json
└── secret-share.service ← systemd service (optional)
```

## Deploy with systemd (Linux)

```bash
cp secret-share.service /etc/systemd/system/
systemctl enable secret-share
systemctl start secret-share
```

## License

MIT
