import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
import fs from 'fs'
import { Boom } from '@hapi/boom'
import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeInMemoryStore } from '@whiskeysockets/baileys'
import { registerCommandHandlers } from './src/bot/handlers/commands.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080
const SESSION_DIR = process.env.SESSION_DIR || './storage/sessions'

fs.mkdirSync(SESSION_DIR, { recursive: true })

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// serve static UI
app.use(express.static(path.join(__dirname, 'public')))

// In-memory registry for demo. Use a DB/Redis in production.
const sockets = new Map() // sessionCode -> sock
const sessionMeta = new Map() // sessionCode -> { phoneNumber, status, createdAt }

function normalizePhone(input) {
  // Expect E.164 without plus as per Baileys docs.
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return null
  return digits
}

async function createSocket(sessionCode) {
  const sessionPath = path.join(SESSION_DIR, sessionCode)
  fs.mkdirSync(sessionPath, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    browser: ['KC CRUIZEE XMD', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        // Render free dynos may sleep — you'll want a process manager or reconnection strategy
        createSocket(sessionCode).catch(console.error)
      } else {
        sockets.delete(sessionCode)
      }
    }
  })

  // Register message handlers/commands
  registerCommandHandlers(sock)

  return sock
}

// Start session & request pairing code
app.post('/api/session/start', async (req, res) => {
  try {
    const { phoneNumber } = req.body || {}
    const phone = normalizePhone(phoneNumber)
    if (!phone) return res.status(400).json({ ok: false, error: 'Provide phoneNumber in E.164 (no plus). Example: 2348012345678' })

    const sessionCode = uuidv4().slice(0, 8) // short alphanumeric for UX
    const sock = await createSocket(sessionCode)
    sockets.set(sessionCode, sock)
    sessionMeta.set(sessionCode, { phoneNumber: phone, status: 'connecting', createdAt: Date.now() })

    // Request pairing code when connecting or QR available (per Baileys docs)
    const pairingCode = await sock.requestPairingCode(phone)

    sessionMeta.get(sessionCode).status = 'pairing_code_issued'

    res.json({ ok: true, sessionCode, pairingCode })
  } catch (err) {
    console.error('start session error', err)
    res.status(500).json({ ok: false, error: err?.message || 'Internal error' })
  }
})

// Session status
app.get('/api/session/:code/status', async (req, res) => {
  const code = req.params.code
  const meta = sessionMeta.get(code)
  if (!meta) return res.status(404).json({ ok: false, error: 'Session not found' })
  const hasSock = sockets.has(code)
  res.json({ ok: true, ...meta, connected: hasSock })
})

// Send a test message to yourself
app.post('/api/session/:code/send', async (req, res) => {
  try {
    const code = req.params.code
    const { to, text } = req.body || {}
    const sock = sockets.get(code)
    if (!sock) return res.status(404).json({ ok: false, error: 'Session not active' })
    if (!to || !text) return res.status(400).json({ ok: false, error: 'to and text required' })

    const jid = to.includes('@s.whatsapp.net') ? to : to.replace(/\D/g,'') + '@s.whatsapp.net'
    await sock.sendMessage(jid, { text })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Send failed' })
  }
})

app.listen(PORT, () => {
  console.log(`KC CRUIZEE XMD server listening on http://localhost:${PORT}`)
  console.log('Open the app in your browser to generate a pairing code.')
})
