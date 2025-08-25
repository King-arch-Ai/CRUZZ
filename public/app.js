const form = document.getElementById('pairForm')
const phone = document.getElementById('phone')
const result = document.getElementById('result')
const sessionCodeEl = document.getElementById('sessionCode')
const pairingCodeEl = document.getElementById('pairingCode')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const v = phone.value.trim()
  if (!/^\d{8,15}$/.test(v.replace(/\D/g,''))) {
    alert('Enter your full WhatsApp number in E.164 (no plus). Example: 2348012345678')
    return
  }
  try {
    const r = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: v })
    })
    const data = await r.json()
    if (!data.ok) throw new Error(data.error || 'Failed')
    sessionCodeEl.textContent = data.sessionCode
    pairingCodeEl.textContent = data.pairingCode
    result.classList.remove('hidden')
  } catch (err) {
    alert(err.message || 'Something went wrong')
  }
})
