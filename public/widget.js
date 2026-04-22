// Ruta: /widget/src/widget.js
// ═══════════════════════════════════════════════════════════════
// CHATBOT IA — Widget Web embebible
// Vanilla JS, sin dependencias.
// Uso:
//   <script src="https://tudominio.com/widget.js"
//           data-channel-id="..."
//           data-supabase-url="https://xxx.supabase.co"
//           data-supabase-anon-key="eyJ..."
//           async></script>
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict'

  // Evitar doble carga
  if (window.__ChatBotIAWidget) return

  // ───── Leer config del script tag ─────
  const currentScript = document.currentScript ||
    Array.from(document.querySelectorAll('script')).find(s => s.src && s.src.includes('widget.js'))

  if (!currentScript) {
    console.error('[ChatBotIA] No se pudo encontrar el script tag')
    return
  }

  const CHANNEL_ID       = currentScript.getAttribute('data-channel-id')
  const SUPABASE_URL     = currentScript.getAttribute('data-supabase-url')
  const SUPABASE_ANON    = currentScript.getAttribute('data-supabase-anon-key')

  if (!CHANNEL_ID || !SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[ChatBotIA] Faltan atributos: data-channel-id, data-supabase-url, data-supabase-anon-key')
    return
  }

  // ───── Estado ─────
  const LS_VISITOR_KEY = `chatbotia_visitor_${CHANNEL_ID}`
  let visitorId = localStorage.getItem(LS_VISITOR_KEY)
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : ('v-' + Math.random().toString(36).slice(2) + Date.now())
    localStorage.setItem(LS_VISITOR_KEY, visitorId)
  }

  const state = {
    open: false,
    config: null,
    sessionId: null,
    conversationId: null,
    messages: [],
    sending: false,
    preChatDone: false,
    realtimeChannel: null
  }

  // ───── Helpers ─────
  async function api(path, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || 'Error desconocido')
    }
    return res.json()
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // ───── Init ─────
  async function init() {
    try {
      const result = await api('widget-session', {
        channelId: CHANNEL_ID,
        visitorId,
        visitorData: {
          currentUrl: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent
        }
      })

      state.config         = result.config
      state.sessionId      = result.sessionId
      state.conversationId = result.conversationId
      state.messages       = result.messages || []

      // Si ya proveyó nombre/email antes, saltar pre-chat
      state.preChatDone = !!(result.sessionId && !needsPreChat())

      injectStyles()
      render()

      if (state.config.autoOpen) {
        setTimeout(() => { state.open = true; render() }, state.config.autoOpenDelayMs || 5000)
      }

      // Suscribirse a realtime si hay conversación
      if (state.conversationId) subscribeRealtime()
    } catch (e) {
      console.error('[ChatBotIA] Init error:', e)
    }
  }

  function needsPreChat() {
    if (!state.config) return false
    return state.config.requireName || state.config.requireEmail || state.config.requirePhone
  }

  // ───── Realtime ─────
  async function subscribeRealtime() {
    console.log('[CBI-DEBUG] subscribeRealtime START. conversationId:', state.conversationId, 'already:', !!state.realtimeChannel)
    if (state.realtimeChannel || !state.conversationId) {
      console.log('[CBI-DEBUG] subscribeRealtime SKIPPED')
      return
    }

    try {
      if (!window.supabase) {
        console.log('[CBI-DEBUG] Loading supabase-js...')
        await loadSupabaseJS()
        console.log('[CBI-DEBUG] supabase-js loaded')
      }

      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        realtime: { params: { eventsPerSecond: 10 } }
      })

      console.log('[CBI-DEBUG] Subscribing to channel widget-conv-' + state.conversationId)

      const channel = client
        .channel(`widget-conv-${state.conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${state.conversationId}`
        }, (payload) => {
          console.log('[CBI-DEBUG] 🔔 MESSAGE RECEIVED:', payload)
          const msg = payload.new
          if (msg.sender_type !== 'contact' && !state.messages.find(m => m.id === msg.id)) {
            console.log('[CBI-DEBUG] Adding to UI')
            state.messages.push({
              id: msg.id,
              sender_type: msg.sender_type,
              content: msg.content,
              created_at: msg.created_at
            })
            renderMessages()
            scrollToBottom()
            if (!state.open) notify()
          } else {
            console.log('[CBI-DEBUG] Skipped - is own or duplicate')
          }
        })
        .subscribe((status, err) => {
          console.log('[CBI-DEBUG] ⚡ Subscription status:', status, err || '')
        })

      state.realtimeChannel = channel
      console.log('[CBI-DEBUG] Channel saved to state')
    } catch (e) {
      console.warn('[CBI-DEBUG] Subscribe FAILED:', e)
      startPolling()
    }
  }

  function loadSupabaseJS() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  // Fallback: polling cada 4s si realtime no está disponible
  let pollInterval = null
  function startPolling() {
    if (pollInterval || !state.conversationId) return
    pollInterval = setInterval(async () => {
      try {
        const result = await api('widget-session', {
          channelId: CHANNEL_ID,
          visitorId
        })
        if (result.messages && result.messages.length !== state.messages.length) {
          const newOnes = result.messages.slice(state.messages.length)
          state.messages = result.messages
          renderMessages()
          scrollToBottom()
          if (!state.open && newOnes.some(m => m.sender_type !== 'contact')) notify()
        }
      } catch (e) { /* silencio */ }
    }, 4000)
  }

  // ───── Enviar mensaje ─────
  async function sendMessage(text) {
    if (!text || !text.trim() || state.sending) return
    if (needsPreChat() && !state.preChatDone) return

    state.sending = true
    const optimisticMsg = {
      id: 'local-' + Date.now(),
      sender_type: 'contact',
      content: text.trim(),
      created_at: new Date().toISOString()
    }
    state.messages.push(optimisticMsg)
    renderMessages()
    scrollToBottom()
    renderInput()  // desactivar input

    try {
      const result = await api('widget-message', {
        sessionId: state.sessionId,
        message: text.trim()
      })

      if (!state.conversationId && result.conversationId) {
        state.conversationId = result.conversationId
        subscribeRealtime()
      }

      // Reemplazar optimistic con el real
      const idx = state.messages.findIndex(m => m.id === optimisticMsg.id)
      if (idx >= 0 && result.contactMessage) {
        state.messages[idx] = result.contactMessage
      }

      // Agregar respuesta del bot si llegó inmediata
      if (result.botMessage) {
        if (!state.messages.find(m => m.id === result.botMessage.id)) {
          state.messages.push(result.botMessage)
        }
      } else if (result.botError) {
        state.messages.push({
          id: 'sys-' + Date.now(),
          sender_type: 'system',
          content: state.config.offlineMessage || 'Un agente te responderá en breve.',
          created_at: new Date().toISOString()
        })
      } else if (result.awaitingHuman) {
        state.messages.push({
          id: 'sys-' + Date.now(),
          sender_type: 'system',
          content: 'Un agente te responderá pronto.',
          created_at: new Date().toISOString()
        })
      }

      renderMessages()
      scrollToBottom()
    } catch (e) {
      // Marcar optimistic como fallido
      const idx = state.messages.findIndex(m => m.id === optimisticMsg.id)
      if (idx >= 0) {
        state.messages[idx].failed = true
      }
      console.error('[ChatBotIA] Error enviando:', e)
      renderMessages()
    } finally {
      state.sending = false
      renderInput()
    }
  }

  // ───── Pre-chat form ─────
  async function submitPreChat(name, email, phone) {
    try {
      const result = await api('widget-session', {
        channelId: CHANNEL_ID,
        visitorId,
        visitorData: { name, email, phone }
      })
      state.sessionId = result.sessionId
      state.preChatDone = true
      render()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  // ───── UI: inyectar estilos ─────
  function injectStyles() {
    if (document.getElementById('chatbotia-styles')) return
    const c = state.config
    const style = document.createElement('style')
    style.id = 'chatbotia-styles'
    style.textContent = `
      .cbi-root { position: fixed; z-index: 2147483000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .cbi-pos-br { bottom: 20px; right: 20px; }
      .cbi-pos-bl { bottom: 20px; left: 20px; }

      .cbi-launcher {
        width: 60px; height: 60px; border-radius: 50%;
        background: ${c.primaryColor};
        box-shadow: 0 4px 24px rgba(0,0,0,0.16);
        display: flex; align-items: center; justify-content: center;
        color: white; font-size: 26px; cursor: pointer; border: none;
        transition: transform 0.2s;
      }
      .cbi-launcher:hover { transform: scale(1.06); }
      .cbi-launcher.cbi-notify::after {
        content: ''; position: absolute; top: 4px; right: 4px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #ef4444; border: 2px solid white;
      }

      .cbi-panel {
        position: absolute; bottom: 80px;
        width: 380px; max-width: calc(100vw - 40px);
        height: 560px; max-height: calc(100vh - 120px);
        background: white; border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.16);
        display: flex; flex-direction: column; overflow: hidden;
      }
      .cbi-pos-br .cbi-panel { right: 0; }
      .cbi-pos-bl .cbi-panel { left: 0; }

      .cbi-header {
        background: ${c.primaryColor};
        color: white; padding: 16px 18px;
        display: flex; align-items: center; gap: 12px;
      }
      .cbi-header-logo {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; flex-shrink: 0;
      }
      .cbi-header-title { font-weight: 600; font-size: 15px; }
      .cbi-header-subtitle { opacity: 0.9; font-size: 12px; }
      .cbi-close {
        margin-left: auto; background: transparent; border: none;
        color: white; cursor: pointer; font-size: 20px; opacity: 0.8;
      }
      .cbi-close:hover { opacity: 1; }

      .cbi-body {
        flex: 1; overflow-y: auto; padding: 16px;
        background: #f8fafc; display: flex; flex-direction: column; gap: 10px;
      }

      .cbi-welcome {
        text-align: center; padding: 20px 8px;
      }
      .cbi-welcome-title { font-size: 18px; font-weight: 600; color: #0f172a; }
      .cbi-welcome-sub { color: #64748b; font-size: 14px; margin-top: 6px; }

      .cbi-msg { max-width: 85%; }
      .cbi-msg-contact { align-self: flex-end; }
      .cbi-msg-bot, .cbi-msg-agent, .cbi-msg-system { align-self: flex-start; }

      .cbi-bubble {
        padding: 9px 13px; border-radius: 14px; font-size: 14px;
        line-height: 1.45; word-wrap: break-word; white-space: pre-wrap;
      }
      .cbi-msg-contact .cbi-bubble {
        background: ${c.primaryColor}; color: white;
        border-bottom-right-radius: 4px;
      }
      .cbi-msg-bot .cbi-bubble, .cbi-msg-agent .cbi-bubble {
        background: white; color: #0f172a;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
      }
      .cbi-msg-system .cbi-bubble {
        background: #fef3c7; color: #78350f;
        font-size: 12px; text-align: center;
      }

      .cbi-msg-failed .cbi-bubble {
        opacity: 0.6; border: 1px dashed #ef4444;
      }

      .cbi-typing {
        align-self: flex-start;
        background: white; border: 1px solid #e2e8f0;
        padding: 12px 14px; border-radius: 14px;
        border-bottom-left-radius: 4px;
        display: flex; gap: 4px;
      }
      .cbi-typing span {
        width: 6px; height: 6px; border-radius: 50%;
        background: #94a3b8;
        animation: cbi-blink 1.4s infinite both;
      }
      .cbi-typing span:nth-child(2) { animation-delay: 0.2s; }
      .cbi-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes cbi-blink { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

      .cbi-input-area {
        padding: 10px 12px; border-top: 1px solid #e2e8f0;
        display: flex; gap: 8px; background: white;
      }
      .cbi-input {
        flex: 1; border: 1px solid #e2e8f0; border-radius: 12px;
        padding: 10px 12px; font-size: 14px; outline: none;
        font-family: inherit; resize: none;
      }
      .cbi-input:focus { border-color: ${c.primaryColor}; }
      .cbi-send {
        background: ${c.primaryColor}; color: white;
        border: none; border-radius: 12px;
        padding: 0 16px; cursor: pointer; font-size: 16px;
      }
      .cbi-send:disabled { opacity: 0.5; cursor: not-allowed; }

      .cbi-powered {
        text-align: center; font-size: 11px; color: #94a3b8;
        padding: 6px; background: white; border-top: 1px solid #f1f5f9;
      }

      .cbi-prechat {
        padding: 20px; display: flex; flex-direction: column; gap: 10px;
      }
      .cbi-prechat-msg { color: #475569; font-size: 14px; margin-bottom: 6px; }
      .cbi-prechat input {
        width: 100%; box-sizing: border-box;
        padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px;
        font-size: 14px; outline: none; font-family: inherit;
      }
      .cbi-prechat input:focus { border-color: ${c.primaryColor}; }
      .cbi-prechat button {
        background: ${c.primaryColor}; color: white; border: none;
        padding: 11px; border-radius: 10px; cursor: pointer;
        font-size: 14px; font-weight: 600; margin-top: 4px;
      }
    `
    document.head.appendChild(style)
  }

  // ───── Render ─────
  let root = null
  function render() {
    if (!state.config) return
    if (!root) {
      root = document.createElement('div')
      root.className = `cbi-root cbi-pos-${state.config.position === 'bottom-left' ? 'bl' : 'br'}`
      document.body.appendChild(root)
    }

    root.innerHTML = `
      <button class="cbi-launcher" id="cbi-launcher">
        ${state.config.launcherIcon || '💬'}
      </button>
      ${state.open ? renderPanel() : ''}
    `

    document.getElementById('cbi-launcher').onclick = () => {
      state.open = !state.open
      render()
      if (state.open) {
        clearNotify()
        setTimeout(scrollToBottom, 50)
      }
    }

    if (state.open) {
      const closeBtn = document.getElementById('cbi-close')
      if (closeBtn) closeBtn.onclick = () => { state.open = false; render() }

      if (needsPreChat() && !state.preChatDone) {
        bindPreChatForm()
      } else {
        bindInput()
      }
    }
  }

  function renderPanel() {
    const c = state.config
    const showPreChat = needsPreChat() && !state.preChatDone

    return `
      <div class="cbi-panel">
        <div class="cbi-header">
          <div class="cbi-header-logo">
            ${c.logoUrl
              ? `<img src="${c.logoUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`
              : (c.launcherIcon || '🤖')}
          </div>
          <div>
            <div class="cbi-header-title">${escapeHtml(c.brandName)}</div>
            <div class="cbi-header-subtitle">En línea</div>
          </div>
          <button class="cbi-close" id="cbi-close">✕</button>
        </div>
        ${showPreChat ? renderPreChat() : renderChat()}
        ${c.showPoweredBy ? '<div class="cbi-powered">Powered by ChatBot IA</div>' : ''}
      </div>
    `
  }

  function renderPreChat() {
    const c = state.config
    return `
      <div class="cbi-prechat">
        <div class="cbi-prechat-msg">${escapeHtml(c.preChatMessage)}</div>
        <form id="cbi-prechat-form">
          ${c.requireName  ? '<input type="text"  name="name"  placeholder="Tu nombre" required />' : ''}
          ${c.requireEmail ? '<input type="email" name="email" placeholder="Tu email" required />' : ''}
          ${c.requirePhone ? '<input type="tel"   name="phone" placeholder="Tu teléfono" required />' : ''}
          <button type="submit">Iniciar conversación</button>
        </form>
      </div>
    `
  }

  function renderChat() {
    return `
      <div class="cbi-body" id="cbi-body">
        ${state.messages.length === 0 ? `
          <div class="cbi-welcome">
            <div class="cbi-welcome-title">${escapeHtml(state.config.welcomeTitle)}</div>
            <div class="cbi-welcome-sub">${escapeHtml(state.config.welcomeSubtitle)}</div>
          </div>
        ` : renderMessagesHtml()}
        ${state.sending ? '<div class="cbi-typing"><span></span><span></span><span></span></div>' : ''}
      </div>
      <div class="cbi-input-area">
        <textarea class="cbi-input" id="cbi-input" rows="1"
          placeholder="${escapeHtml(state.config.inputPlaceholder)}"
          ${state.sending ? 'disabled' : ''}></textarea>
        <button class="cbi-send" id="cbi-send" ${state.sending ? 'disabled' : ''}>→</button>
      </div>
    `
  }

  function renderMessagesHtml() {
    return state.messages.map(m => {
      const cls = `cbi-msg cbi-msg-${m.sender_type}${m.failed ? ' cbi-msg-failed' : ''}`
      return `<div class="${cls}"><div class="cbi-bubble">${escapeHtml(m.content)}</div></div>`
    }).join('')
  }

  function renderMessages() {
    const body = document.getElementById('cbi-body')
    if (!body) return
    body.innerHTML = state.messages.length === 0 ? `
      <div class="cbi-welcome">
        <div class="cbi-welcome-title">${escapeHtml(state.config.welcomeTitle)}</div>
        <div class="cbi-welcome-sub">${escapeHtml(state.config.welcomeSubtitle)}</div>
      </div>
    ` : renderMessagesHtml()
    if (state.sending) {
      body.innerHTML += '<div class="cbi-typing"><span></span><span></span><span></span></div>'
    }
  }

  function renderInput() {
    const input = document.getElementById('cbi-input')
    const send = document.getElementById('cbi-send')
    if (input) input.disabled = state.sending
    if (send) send.disabled = state.sending
    if (input && !state.sending) input.focus()
  }

  function bindInput() {
    const input = document.getElementById('cbi-input')
    const send = document.getElementById('cbi-send')
    if (!input || !send) return

    const doSend = () => {
      const txt = input.value.trim()
      if (!txt) return
      input.value = ''
      sendMessage(txt)
    }

    send.onclick = doSend
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        doSend()
      }
    }
    setTimeout(() => input.focus(), 100)
  }

  function bindPreChatForm() {
    const form = document.getElementById('cbi-prechat-form')
    if (!form) return
    form.onsubmit = (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      submitPreChat(fd.get('name'), fd.get('email'), fd.get('phone'))
    }
  }

  function scrollToBottom() {
    const body = document.getElementById('cbi-body')
    if (body) body.scrollTop = body.scrollHeight
  }

  function notify() {
    const launcher = document.getElementById('cbi-launcher')
    if (launcher) launcher.classList.add('cbi-notify')
  }

  function clearNotify() {
    const launcher = document.getElementById('cbi-launcher')
    if (launcher) launcher.classList.remove('cbi-notify')
  }

  // ───── Marcar como cargado y arrancar ─────
  window.__ChatBotIAWidget = { state, version: '1.0.0' }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
