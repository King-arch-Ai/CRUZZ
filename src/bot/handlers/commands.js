import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gTTS from 'gtts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple prefixes and commands
const PREFIX = '!'

export function registerCommandHandlers(sock) {
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages?.[0]
      if (!msg || !msg.message || msg.key.fromMe) return
      const from = msg.key.remoteJid
      const type = Object.keys(msg.message)[0]
      const text = type === 'conversation'
        ? msg.message.conversation
        : msg.message?.extendedTextMessage?.text || ''

      if (!text.startsWith(PREFIX)) return

      const [cmd, ...args] = text.slice(PREFIX.length).trim().split(/\s+/)
      const lc = cmd.toLowerCase()

      if (lc === 'ping') {
        await sock.sendMessage(from, { text: 'pong 🏓' })
      }

      else if (lc === 'menu') {
        await sock.sendMessage(from, { text: [
          '*KC CRUIZEE XMD — Commands*',
          '!ping — check bot live',
          '!say <text> — echo',
          '!tts <text> — text to speech (voice note)',
          '!add <e164> — add number to group (admin only)',
          '!kick @user — remove member (admin only)',
          '!tagall — mention everyone (admin only)'
        ].join('\n') })
      }

      else if (lc === 'say') {
        const phrase = args.join(' ')
        await sock.sendMessage(from, { text: phrase || 'say what?' })
      }

      else if (lc === 'tts') {
        const phrase = args.join(' ')
        if (!phrase) return await sock.sendMessage(from, { text: 'Usage: !tts your words' })
        const tmp = path.join(__dirname, '../../..', 'storage', 'tmp')
        fs.mkdirSync(tmp, { recursive: true })
        const out = path.join(tmp, `tts_${Date.now()}.mp3`)
        const tts = new gTTS(phrase, 'en')
        await new Promise((resolve, reject) => tts.save(out, (err) => err ? reject(err) : resolve()))
        await sock.sendMessage(from, { audio: { url: out }, mimetype: 'audio/mpeg', ptt: true })
      }

      else if (lc === 'tagall') {
        const meta = await sock.groupMetadata(from).catch(() => null)
        if (!meta) return await sock.sendMessage(from, { text: 'This only works in a group.' })
        const mentions = meta.participants.map(p => p.id)
        const text = 'Roll call!\n' + mentions.map(m => `@${m.split('@')[0]}`).join(' ')
        await sock.sendMessage(from, { text, mentions })
      }

      else if (lc === 'add') {
        const meta = await sock.groupMetadata(from).catch(() => null)
        if (!meta) return await sock.sendMessage(from, { text: 'Group-only command.' })
        const number = (args[0] || '').replace(/\D/g, '')
        if (!number) return await sock.sendMessage(from, { text: 'Usage: !add 2348012345678' })
        await sock.groupParticipantsUpdate(from, [`${number}@s.whatsapp.net`], 'add')
        await sock.sendMessage(from, { text: `Tried to add ${number}` })
      }

      else if (lc === 'kick') {
        const meta = await sock.groupMetadata(from).catch(() => null)
        if (!meta) return await sock.sendMessage(from, { text: 'Group-only command.' })
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        if (!mentioned.length) return await sock.sendMessage(from, { text: 'Tag someone to kick. Usage: !kick @user' })
        await sock.groupParticipantsUpdate(from, mentioned, 'remove')
        await sock.sendMessage(from, { text: `Tried to remove ${mentioned.map(m=>m.split('@')[0]).join(', ')}` })
      }
    } catch (e) {
      console.error('command error', e)
    }
  })
}
