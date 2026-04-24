/**
 * LORA Chat Widget — Sprint 11
 * Vanilla JS, sin dependencias.
 *
 * Features:
 *   - Carga config dinámica desde widget-config edge function
 *   - Pre-chat form configurable (nombre/email/phone/motivo)
 *   - Post-chat CSAT con estrellas
 *   - Branding custom por tenant
 *   - Realtime (WebSocket de Supabase)
 *
 * Uso:
 *   <script>window.LoraChat = { channelId: 'uuid' };</script>
 *   <script async src="https://lora.jabenter.com/widget.js"></script>
 */
(function () {
  'use strict'

  // ─────────────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://imvahmyywbtcfsduwbdq.supabase.co'
  const SUPABASE_ANON_KEY = window.LORA_SUPABASE_ANON_KEY || '' // se inyecta en build

  const config = window.LoraChat || {}
  if (!config.channelId) {
    console.warn('[LORA] channelId no definido. El widget no puede cargar.')
    return
  }

  // State
  let settings = null
  let sessionId = null
  let conversationId = null
  let contactId = null
  let preChatData = {}  // datos del form pre-chat
  let chatStarted = false
  let realtimeChannel = null

  // ─────────────────────────────────────────────────────
  // FETCH CONFIG
  // ─────────────────────────────────────────────────────
  async function fetchSettings() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/widget-config?channel_id=${config.channelId}`,
        { headers: SUPABASE_ANON_KEY ? { 'apikey': SUPABASE_ANON_KEY } : {} }
      )
      if (!res.ok) throw new Error('Config fetch failed')
      const json = await res.json()
      settings = json.settings || defaultSettings()
    } catch (e) {
      console.warn('[LORA] Usando config default:', e.message)
      settings = defaultSettings()
    }
  }

  function defaultSettings() {
    return {
      branding: {
        primary_color: '#0071E3', position: 'right', offset_x: 20, offset_y: 20,
        logo_url: null, brand_name: 'Asistente',
        welcome_message: '¡Hola! ¿En qué puedo ayudarte?',
        placeholder: 'Escribe tu mensaje...'
      },
      pre_chat: {
        enabled: false, mode: 'required',
        title: 'Antes de empezar', subtitle: 'Ayúdanos a atenderte mejor',
        submit_label: 'Iniciar conversación', skip_label: 'Chatear como invitado',
        fields: []
      },
      post_chat: {
        enabled: false, ask_csat: true,
        title: '¿Cómo fue tu atención?', subtitle: 'Tu opinión nos ayuda a mejorar',
        thank_you_message: '¡Gracias por tu tiempo!',
        comment_enabled: false, comment_placeholder: 'Cuéntanos más (opcional)'
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // STYLES (inyectados)
  // ─────────────────────────────────────────────────────
  function injectStyles() {
    const s = settings.branding
    const css = `
      #lora-chat-root *, #lora-chat-root *::before, #lora-chat-root *::after {
        box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #lora-chat-fab {
        position: fixed; ${s.position === 'left' ? 'left' : 'right'}: ${s.offset_x}px;
        bottom: ${s.offset_y}px; width: 60px; height: 60px; border-radius: 50%;
        background: ${s.primary_color}; color: white; display: flex; align-items: center;
        justify-content: center; cursor: pointer; z-index: 999998;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s;
        border: none; font-size: 28px;
      }
      #lora-chat-fab:hover { transform: scale(1.05); }
      #lora-chat-window {
        position: fixed; ${s.position === 'left' ? 'left' : 'right'}: ${s.offset_x}px;
        bottom: ${s.offset_y + 80}px; width: 380px; height: 560px; max-height: calc(100vh - 120px);
        background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        display: none; flex-direction: column; z-index: 999999; overflow: hidden;
        animation: lora-slide-up 0.3s ease-out;
      }
      @keyframes lora-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      #lora-chat-window.open { display: flex; }
      #lora-chat-header {
        padding: 16px; background: ${s.primary_color}; color: white; display: flex;
        align-items: center; gap: 10px; flex-shrink: 0;
      }
      #lora-chat-header-logo { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 600; overflow: hidden; }
      #lora-chat-header-logo img { width: 100%; height: 100%; object-fit: cover; }
      #lora-chat-close { margin-left: auto; background: transparent; border: none; color: white; cursor: pointer; font-size: 18px; opacity: 0.8; padding: 4px; }
      #lora-chat-close:hover { opacity: 1; }
      #lora-chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; }
      .lora-msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; word-wrap: break-word; white-space: pre-wrap; }
      .lora-msg-contact { background: ${s.primary_color}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
      .lora-msg-bot, .lora-msg-agent { background: white; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }
      #lora-chat-input-row { padding: 12px; border-top: 1px solid #e2e8f0; background: white; display: flex; gap: 8px; flex-shrink: 0; }
      #lora-chat-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 8px 14px; font-size: 14px; outline: none; }
      #lora-chat-input:focus { border-color: ${s.primary_color}; }
      #lora-chat-send { background: ${s.primary_color}; color: white; border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 16px; flex-shrink: 0; }
      #lora-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
      .lora-form { padding: 24px 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; background: #f8f9fa; overflow-y: auto; }
      .lora-form-title { font-size: 17px; font-weight: 600; color: #1e293b; margin: 0; }
      .lora-form-subtitle { font-size: 13px; color: #64748b; margin: 0 0 8px 0; }
      .lora-form-field { display: flex; flex-direction: column; gap: 4px; }
      .lora-form-label { font-size: 12px; color: #475569; font-weight: 500; }
      .lora-form-label .lora-req { color: #ef4444; margin-left: 2px; }
      .lora-form-input, .lora-form-select {
        padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;
        outline: none; background: white; width: 100%;
      }
      .lora-form-input:focus, .lora-form-select:focus { border-color: ${s.primary_color}; }
      .lora-form-button {
        margin-top: 8px; padding: 12px; background: ${s.primary_color}; color: white; border: none;
        border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
      }
      .lora-form-button:hover { filter: brightness(1.05); }
      .lora-form-skip {
        padding: 8px; background: transparent; border: none; color: #64748b; font-size: 13px;
        cursor: pointer; text-decoration: underline;
      }
      .lora-form-error { color: #ef4444; font-size: 12px; margin-top: -2px; }
      .lora-postchat { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; flex: 1; background: #f8f9fa; }
      .lora-stars { display: flex; gap: 8px; font-size: 36px; color: #cbd5e1; }
      .lora-star { cursor: pointer; transition: color 0.15s, transform 0.15s; }
      .lora-star:hover { transform: scale(1.15); }
      .lora-star.active { color: #f59e0b; }
      .lora-thank-you { padding: 40px 20px; text-align: center; background: #f8f9fa; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
      .lora-thank-you-emoji { font-size: 48px; }
      .lora-thank-you-text { font-size: 16px; color: #334155; font-weight: 500; }
    `
    const styleEl = document.createElement('style')
    styleEl.id = 'lora-chat-styles'
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }

  // ─────────────────────────────────────────────────────
  // API helpers
  // ─────────────────────────────────────────────────────
  async function apiCall(path, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SUPABASE_ANON_KEY ? { 'apikey': SUPABASE_ANON_KEY } : {})
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
    return res.json()
  }

  // ─────────────────────────────────────────────────────
  // RENDER FUNCTIONS
  // ─────────────────────────────────────────────────────
  const root = document.createElement('div')
  root.id = 'lora-chat-root'
  document.body.appendChild(root)

  function renderFab() {
    root.innerHTML = `
      <button id="lora-chat-fab" aria-label="Abrir chat">💬</button>
      <div id="lora-chat-window" role="dialog" aria-label="Chat"></div>
    `
    document.getElementById('lora-chat-fab').onclick = toggleWindow
  }

  function toggleWindow() {
    const w = document.getElementById('lora-chat-window')
    if (w.classList.contains('open')) {
      w.classList.remove('open')
    } else {
      openWindow()
    }
  }

  function openWindow() {
    const w = document.getElementById('lora-chat-window')
    w.classList.add('open')

    // Decidir qué mostrar
    if (!chatStarted) {
      if (settings.pre_chat.enabled) {
        renderPreChatForm()
      } else {
        startChat()
      }
    } else {
      // Ya hay chat en curso
      renderChatUI()
    }
  }

  function renderHeader(closeHandler) {
    const s = settings.branding
    const initial = (s.brand_name || 'L').charAt(0).toUpperCase()
    return `
      <div id="lora-chat-header">
        <div id="lora-chat-header-logo">
          ${s.logo_url ? `<img src="${s.logo_url}" alt="${s.brand_name}"/>` : initial}
        </div>
        <div style="display:flex;flex-direction:column;">
          <strong style="font-size:14px;">${escape(s.brand_name)}</strong>
          <span style="font-size:11px;opacity:0.8;">En línea</span>
        </div>
        <button id="lora-chat-close" aria-label="Cerrar">✕</button>
      </div>
    `
  }

  function attachHeaderClose() {
    const btn = document.getElementById('lora-chat-close')
    if (btn) btn.onclick = toggleWindow
  }

  function renderPreChatForm() {
    const w = document.getElementById('lora-chat-window')
    const pc = settings.pre_chat

    const visibleFields = (pc.fields || [])
      .filter(f => f.visible)
      .sort((a, b) => a.order - b.order)

    const fieldsHtml = visibleFields.map(f => {
      const reqMark = f.required ? '<span class="lora-req">*</span>' : ''
      if (f.key === 'reason') {
        const opts = (f.options || []).map(o => `<option value="${escape(o)}">${escape(o)}</option>`).join('')
        return `
          <div class="lora-form-field">
            <label class="lora-form-label">${escape(f.label)}${reqMark}</label>
            <select class="lora-form-select" data-field="${f.key}" ${f.required ? 'required' : ''}>
              <option value="">Selecciona una opción</option>
              ${opts}
            </select>
          </div>
        `
      }
      const type = f.key === 'email' ? 'email' : (f.key === 'phone' ? 'tel' : 'text')
      return `
        <div class="lora-form-field">
          <label class="lora-form-label">${escape(f.label)}${reqMark}</label>
          <input
            type="${type}"
            class="lora-form-input"
            data-field="${f.key}"
            placeholder="${escape(f.placeholder || '')}"
            ${f.required ? 'required' : ''}
          />
        </div>
      `
    }).join('')

    const skipBtn = pc.mode === 'optional'
      ? `<button type="button" class="lora-form-skip" id="lora-form-skip">${escape(pc.skip_label)}</button>`
      : ''

    w.innerHTML = `
      ${renderHeader()}
      <form class="lora-form" id="lora-prechat-form">
        <h3 class="lora-form-title">${escape(pc.title)}</h3>
        <p class="lora-form-subtitle">${escape(pc.subtitle)}</p>
        ${fieldsHtml}
        <div id="lora-form-error" class="lora-form-error" style="display:none;"></div>
        <button type="submit" class="lora-form-button">${escape(pc.submit_label)}</button>
        ${skipBtn}
      </form>
    `

    attachHeaderClose()
    document.getElementById('lora-prechat-form').onsubmit = handlePreChatSubmit
    const skip = document.getElementById('lora-form-skip')
    if (skip) skip.onclick = () => { preChatData = {}; startChat() }
  }

  function handlePreChatSubmit(e) {
    e.preventDefault()
    const form = e.target
    const data = {}
    const pc = settings.pre_chat

    for (const f of (pc.fields || []).filter(x => x.visible)) {
      const el = form.querySelector(`[data-field="${f.key}"]`)
      if (!el) continue
      const val = (el.value || '').trim()
      if (f.required && !val) {
        showFormError(`Completa: ${f.label}`)
        return
      }
      if (f.key === 'email' && val && !/^\S+@\S+\.\S+$/.test(val)) {
        showFormError('Email no válido')
        return
      }
      if (val) data[f.key] = val
    }
    preChatData = data
    startChat()
  }

  function showFormError(msg) {
    const el = document.getElementById('lora-form-error')
    if (el) { el.textContent = msg; el.style.display = 'block' }
  }

  // ─────────────────────────────────────────────────────
  // CHAT UI
  // ─────────────────────────────────────────────────────
  async function startChat() {
    try {
      const res = await apiCall('widget-session', {
        channel_id: config.channelId,
        pre_chat_data: preChatData
      })
      sessionId = res.session_id
      conversationId = res.conversation_id
      contactId = res.contact_id
      chatStarted = true
      renderChatUI()
      subscribeRealtime()
    } catch (e) {
      console.error('[LORA] Error iniciando chat:', e)
      alert('No se pudo iniciar el chat. Inténtalo más tarde.')
    }
  }

  function renderChatUI() {
    const w = document.getElementById('lora-chat-window')
    const s = settings.branding
    w.innerHTML = `
      ${renderHeader()}
      <div id="lora-chat-body"></div>
      <div id="lora-chat-input-row">
        <input id="lora-chat-input" type="text" placeholder="${escape(s.placeholder)}" />
        <button id="lora-chat-send" aria-label="Enviar">→</button>
      </div>
    `
    attachHeaderClose()

    // Mensaje de bienvenida (solo visual, no se guarda)
    addMessage('bot', s.welcome_message)

    const input = document.getElementById('lora-chat-input')
    const sendBtn = document.getElementById('lora-chat-send')

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
    })
    sendBtn.onclick = sendMsg
  }

  async function sendMsg() {
    const input = document.getElementById('lora-chat-input')
    const text = (input.value || '').trim()
    if (!text) return

    addMessage('contact', text)
    input.value = ''
    input.focus()

    try {
      await apiCall('widget-message', {
        session_id: sessionId,
        content: text
      })
    } catch (e) {
      console.error('[LORA] Error enviando:', e)
      addMessage('bot', '⚠️ No se pudo enviar. Inténtalo de nuevo.')
    }
  }

  function addMessage(senderType, content) {
    const body = document.getElementById('lora-chat-body')
    if (!body) return
    const el = document.createElement('div')
    el.className = `lora-msg lora-msg-${senderType}`
    el.textContent = content
    body.appendChild(el)
    body.scrollTop = body.scrollHeight
  }

  // ─────────────────────────────────────────────────────
  // REALTIME
  // ─────────────────────────────────────────────────────
  function subscribeRealtime() {
    if (!window.supabase || !window.supabase.createClient) {
      // Cargar supabase-js dinámicamente
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
      s.onload = () => doSubscribe()
      document.head.appendChild(s)
    } else {
      doSubscribe()
    }
  }

  function doSubscribe() {
    if (!window.supabase || !SUPABASE_ANON_KEY) return
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    realtimeChannel = client
      .channel(`widget-${conversationId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new
          // Mostrar solo mensajes del bot/agent (no eco del cliente ni whispers ni system)
          if (msg.sender_type === 'bot' || msg.sender_type === 'agent') {
            addMessage(msg.sender_type, msg.content)
          }
        }
      )
      .subscribe()
  }

  // ─────────────────────────────────────────────────────
  // POST-CHAT (se dispara cuando conversación pasa a resolved)
  // ─────────────────────────────────────────────────────
  function showPostChat() {
    const pc = settings.post_chat
    if (!pc.enabled) return closeAndReset()

    const w = document.getElementById('lora-chat-window')
    w.innerHTML = `
      ${renderHeader()}
      <div class="lora-postchat">
        <div style="font-size:40px;">⭐</div>
        <h3 class="lora-form-title">${escape(pc.title)}</h3>
        <p class="lora-form-subtitle">${escape(pc.subtitle)}</p>
        ${pc.ask_csat ? `<div class="lora-stars" id="lora-stars" role="radiogroup" aria-label="Calificación">
          ${[1,2,3,4,5].map(n => `<span class="lora-star" data-star="${n}" role="radio">★</span>`).join('')}
        </div>` : ''}
        ${pc.comment_enabled ? `<textarea id="lora-comment" class="lora-form-input" rows="3" placeholder="${escape(pc.comment_placeholder)}"></textarea>` : ''}
        <button class="lora-form-button" id="lora-submit-csat">Enviar</button>
        <button class="lora-form-skip" id="lora-skip-csat">Saltar</button>
      </div>
    `
    attachHeaderClose()

    let rating = 0
    if (pc.ask_csat) {
      const stars = document.querySelectorAll('.lora-star')
      stars.forEach(star => {
        star.onclick = () => {
          rating = parseInt(star.dataset.star)
          stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.star) <= rating))
        }
      })
    }

    document.getElementById('lora-submit-csat').onclick = async () => {
      const comment = pc.comment_enabled ? (document.getElementById('lora-comment').value || '') : ''
      if (pc.ask_csat && rating === 0) {
        alert('Por favor selecciona una calificación')
        return
      }
      try {
        await apiCall('widget-csat', {
          conversation_id: conversationId,
          rating: rating || null,
          feedback: comment || null
        })
      } catch (e) {
        console.warn('[LORA] Error CSAT:', e)
      }
      showThankYou()
    }

    document.getElementById('lora-skip-csat').onclick = showThankYou
  }

  function showThankYou() {
    const pc = settings.post_chat
    const w = document.getElementById('lora-chat-window')
    w.innerHTML = `
      ${renderHeader()}
      <div class="lora-thank-you">
        <div class="lora-thank-you-emoji">🙏</div>
        <div class="lora-thank-you-text">${escape(pc.thank_you_message)}</div>
      </div>
    `
    attachHeaderClose()
    setTimeout(closeAndReset, 3000)
  }

  function closeAndReset() {
    const w = document.getElementById('lora-chat-window')
    if (w) w.classList.remove('open')
    // Reset para próxima vez
    sessionId = null
    conversationId = null
    contactId = null
    preChatData = {}
    chatStarted = false
    if (realtimeChannel) {
      try { realtimeChannel.unsubscribe() } catch {}
      realtimeChannel = null
    }
  }

  // ─────────────────────────────────────────────────────
  // Utils
  // ─────────────────────────────────────────────────────
  function escape(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  // ─────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────
  async function init() {
    await fetchSettings()
    injectStyles()
    renderFab()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Expose API para testing / triggers externos
  window.LoraChatAPI = {
    open: openWindow,
    close: closeAndReset,
    showPostChat: showPostChat  // útil para probar manualmente
  }
})()
