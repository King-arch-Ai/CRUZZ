# KC CRUIZEE XMD

WhatsApp helper bot using [Baileys](https://github.com/WhiskeySockets/Baileys) + Express, with a slick video-background UI to generate a **pairing code** (phone-number login) and link your WhatsApp.

## Features
- Pairing-code login (no QR) via Baileys
- Minimal UI with video background to collect phone number and show the code
- Basic commands: `!ping`, `!menu`, `!say`, `!tts` (voice note), `!tagall`, `!add`, `!kick`
- REST endpoint to send a test message
- Deployable to Render (free plan friendly)

> ⚠️ **Important**: Using third-party libraries to automate WhatsApp may violate WhatsApp's Terms of Service. Use for personal/dev purposes, at your own risk.

## Quickstart (Local)
```bash
npm i
cp .env.example .env
npm run dev
# open http://localhost:8080
```

Enter your number in E.164 format **without the +** (e.g. `2348012345678`), click *Generate Pairing Code*, then on your phone:
WhatsApp → Settings → Linked devices → *Link a device* → *Link with phone number* → enter the pairing code shown.

## Deploy to Render
- Push this repo to GitHub
- Create new **Web Service** on Render → connect repo
- Render will use `render.yaml` / `npm start`
- Remember: free disk is ephemeral; use Redis/DB store for sessions in production.

## Endpoints
- `POST /api/session/start` `{ phoneNumber }` → `{ sessionCode, pairingCode }`
- `GET /api/session/:code/status` → status info
- `POST /api/session/:code/send` `{ to, text }` → send message

## Customize Commands
Edit `src/bot/handlers/commands.js`. Add your own `!command` branches.

## License
MIT
