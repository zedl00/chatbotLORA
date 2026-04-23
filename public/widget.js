// Ruta: /public/widget.js
// ═══════════════════════════════════════════════════════════════
// LORA — Widget Web embebible
// Chat inteligente omnicanal. Vanilla JS, sin dependencias.
//
// Instalación:
//   <script src="https://admin.lorachat.net/widget.js"
//           data-channel-id="..."
//           data-supabase-url="https://xxx.supabase.co"
//           data-supabase-anon-key="eyJ..."
//           async></script>
//
// Version: 2.0.0 — Rebrand LORA + animaciones + mobile + a11y
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict'

  // Evitar doble carga (soporta tanto el namespace viejo como el nuevo durante la migración)
  if (window.__LoraWidget || window.__ChatBotIAWidget) return

  // ───── Leer config del script tag ─────
  const currentScript = document.currentScript ||
    Array.from(document.querySelectorAll('script')).find(s => s.src && s.src.includes('widget.js'))

  if (!currentScript) {
    console.error('[LORA] No se pudo encontrar el script tag')
    return
  }

  const CHANNEL_ID       = currentScript.getAttribute('data-channel-id')
  const SUPABASE_URL     = currentScript.getAttribute('data-supabase-url')
  const SUPABASE_ANON    = currentScript.getAttribute('data-supabase-anon-key')

  if (!CHANNEL_ID || !SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[LORA] Faltan atributos: data-channel-id, data-supabase-url, data-supabase-anon-key')
    return
  }

  // ───── Migración suave del storage key ─────
  // Después de 60 días en producción se puede eliminar este bloque.
  const LS_VISITOR_KEY = `lora_visitor_${CHANNEL_ID}`
  const OLD_VISITOR_KEY = `chatbotia_visitor_${CHANNEL_ID}`
  let visitorId = localStorage.getItem(LS_VISITOR_KEY)

  if (!visitorId) {
    // Intentar migrar desde la llave vieja
    const oldId = localStorage.getItem(OLD_VISITOR_KEY)
    if (oldId) {
      visitorId = oldId
      localStorage.setItem(LS_VISITOR_KEY, visitorId)
      localStorage.removeItem(OLD_VISITOR_KEY)
    } else {
      visitorId = crypto.randomUUID ? crypto.randomUUID() : ('v-' + Math.random().toString(36).slice(2) + Date.now())
      localStorage.setItem(LS_VISITOR_KEY, visitorId)
    }
  }

  // ───── Estado ─────
  const state = {
    open: false,
    config: null,
    sessionId: null,
    conversationId: null,
    messages: [],
    sending: false,
    preChatDone: false,
    realtimeChannel: null,
    unreadCount: 0
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
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Lighten/darken hex color by a factor (-1 to 1)
  function adjustColor(hex, factor) {
    const h = hex.replace('#', '')
    let r = parseInt(h.substring(0, 2), 16)
    let g = parseInt(h.substring(2, 4), 16)
    let b = parseInt(h.substring(4, 6), 16)

    if (factor > 0) {
      r = Math.round(r + (255 - r) * factor)
      g = Math.round(g + (255 - g) * factor)
      b = Math.round(b + (255 - b) * factor)
    } else {
      r = Math.round(r * (1 + factor))
      g = Math.round(g * (1 + factor))
      b = Math.round(b * (1 + factor))
    }

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
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
      console.error('[LORA] Init error:', e)
    }
  }

  function needsPreChat() {
    if (!state.config) return false
    return state.config.requireName || state.config.requireEmail || state.config.requirePhone
  }

  // ───── Realtime ─────
  async function subscribeRealtime() {
    if (state.realtimeChannel || !state.conversationId) return

    try {
      if (!window.supabase) {
        await loadSupabaseJS()
      }

      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        realtime: { params: { eventsPerSecond: 10 } }
      })

      const channel = client
        .channel(`widget-conv-${state.conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${state.conversationId}`
        }, (payload) => {
          const msg = payload.new
          if (msg.sender_type !== 'contact' && !state.messages.find(m => m.id === msg.id)) {
            state.messages.push({
              id: msg.id,
              sender_type: msg.sender_type,
              content: msg.content,
              created_at: msg.created_at
            })
            renderMessages()
            scrollToBottom()
            if (!state.open) notify()
          }
        })
        .subscribe()

      state.realtimeChannel = channel
    } catch (e) {
      console.warn('[LORA] Realtime unavailable, falling back to polling:', e)
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
    renderInput()

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
      const idx = state.messages.findIndex(m => m.id === optimisticMsg.id)
      if (idx >= 0) {
        state.messages[idx].failed = true
      }
      console.error('[LORA] Error enviando:', e)
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

  // ───── UI: inyectar estilos premium ─────
  function injectStyles() {
    if (document.getElementById('lora-styles')) return
    const c = state.config
    const primary = c.primaryColor || '#0071E3'
    const primaryDark = adjustColor(primary, -0.15)
    const primaryLight = adjustColor(primary, 0.1)

    const style = document.createElement('style')
    style.id = 'lora-styles'
    style.textContent = `
      /* LORA Widget v2.0 — Premium styles */
      .lora-root {
        position: fixed;
        z-index: 2147483000;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-feature-settings: 'ss01','cv11';
        -webkit-font-smoothing: antialiased;
      }
      .lora-root *, .lora-root *::before, .lora-root *::after {
        box-sizing: border-box;
      }
      .lora-pos-br { bottom: 20px; right: 20px; }
      .lora-pos-bl { bottom: 20px; left: 20px; }

      /* ═══ LAUNCHER ═══ */
      .lora-launcher {
        width: 60px; height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        box-shadow:
          0 8px 24px ${hexToRgba(primary, 0.35)},
          0 2px 6px rgba(0, 0, 0, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
        display: flex; align-items: center; justify-content: center;
        color: white;
        font-size: 26px;
        cursor: pointer;
        border: none;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        animation: lora-launcher-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        outline: none;
      }
      .lora-launcher:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow:
          0 12px 32px ${hexToRgba(primary, 0.45)},
          0 4px 10px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.25);
      }
      .lora-launcher:active { transform: scale(1.02) translateY(0); }
      .lora-launcher:focus-visible {
        box-shadow:
          0 8px 24px ${hexToRgba(primary, 0.35)},
          0 0 0 3px white,
          0 0 0 5px ${primary};
      }
      @keyframes lora-launcher-in {
        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
        60% { transform: scale(1.1) rotate(5deg); opacity: 1; }
        100% { transform: scale(1) rotate(0); opacity: 1; }
      }

      /* Unread badge */
      .lora-launcher .lora-badge {
        position: absolute;
        top: -2px; right: -2px;
        min-width: 20px; height: 20px;
        border-radius: 10px;
        background: #ef4444;
        border: 2px solid white;
        color: white;
        font-size: 11px;
        font-weight: 700;
        font-family: 'Inter', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        animation: lora-badge-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes lora-badge-in {
        from { transform: scale(0); }
        to { transform: scale(1); }
      }

      /* ═══ PANEL ═══ */
      .lora-panel {
        position: absolute;
        bottom: 80px;
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 680px;
        max-height: calc(100vh - 80px);
        background: white;
        border-radius: 20px;
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.15),
          0 4px 16px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(0, 0, 0, 0.04);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform-origin: bottom right;
        animation: lora-panel-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lora-pos-br .lora-panel { right: 0; transform-origin: bottom right; }
      .lora-pos-bl .lora-panel { left: 0; transform-origin: bottom left; }

      @keyframes lora-panel-in {
        from { opacity: 0; transform: scale(0.92) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* ═══ HEADER ═══ */
      .lora-header {
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        color: white;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        position: relative;
        overflow: hidden;
      }
      .lora-header::before {
        content: '';
        position: absolute;
        top: -50%; left: -50%;
        width: 200%; height: 200%;
        background: radial-gradient(circle at 70% 30%, ${hexToRgba('#ffffff', 0.15)} 0%, transparent 50%);
        pointer-events: none;
      }
      .lora-header > * { position: relative; z-index: 1; }

      .lora-header-logo {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .lora-header-title {
        font-weight: 600;
        font-size: 15px;
        letter-spacing: -0.01em;
      }
      .lora-header-subtitle {
        opacity: 0.85;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .lora-header-subtitle::before {
        content: '';
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 8px #4ade80;
      }
      .lora-close {
        margin-left: auto;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 20px;
        opacity: 0.8;
        width: 32px; height: 32px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
      }
      .lora-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
      }
      .lora-close:focus-visible {
        outline: 2px solid white;
        outline-offset: 2px;
      }

      /* ═══ BODY ═══ */
      .lora-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 16px;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }
      .lora-body::-webkit-scrollbar { width: 6px; }
      .lora-body::-webkit-scrollbar-track { background: transparent; }
      .lora-body::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 3px;
      }

      /* ═══ WELCOME ═══ */
      .lora-welcome {
        text-align: center;
        padding: 32px 16px;
        animation: lora-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lora-welcome-icon {
        width: 56px; height: 56px;
        margin: 0 auto 16px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 24px;
        box-shadow: 0 8px 24px ${hexToRgba(primary, 0.25)};
      }
      .lora-welcome-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }
      .lora-welcome-sub {
        color: #64748b;
        font-size: 14px;
        margin-top: 8px;
        line-height: 1.5;
      }

      /* ═══ MESSAGES ═══ */
      .lora-msg {
        max-width: 85%;
        animation: lora-msg-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes lora-msg-in {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes lora-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .lora-msg-contact { align-self: flex-end; }
      .lora-msg-bot,
      .lora-msg-agent,
      .lora-msg-system { align-self: flex-start; }

      .lora-bubble {
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
        white-space: pre-wrap;
        letter-spacing: -0.005em;
      }
      .lora-msg-contact .lora-bubble {
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        color: white;
        border-bottom-right-radius: 4px;
        box-shadow: 0 2px 8px ${hexToRgba(primary, 0.2)};
      }
      .lora-msg-bot .lora-bubble,
      .lora-msg-agent .lora-bubble {
        background: white;
        color: #0f172a;
        border: 1px solid #e5e7eb;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }
      .lora-msg-system .lora-bubble {
        background: ${hexToRgba(primary, 0.08)};
        color: ${primaryDark};
        font-size: 12px;
        text-align: center;
        border-radius: 10px;
        padding: 8px 14px;
        max-width: 100%;
      }
      .lora-msg-failed .lora-bubble {
        opacity: 0.55;
        border: 1px dashed #ef4444;
      }

      /* ═══ TYPING INDICATOR ═══ */
      .lora-typing {
        align-self: flex-start;
        background: white;
        border: 1px solid #e5e7eb;
        padding: 13px 16px;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        display: flex;
        gap: 5px;
        animation: lora-msg-in 0.3s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }
      .lora-typing span {
        width: 7px; height: 7px;
        border-radius: 50%;
        background: ${primary};
        animation: lora-typing-bounce 1.4s infinite both;
      }
      .lora-typing span:nth-child(1) { animation-delay: 0s; }
      .lora-typing span:nth-child(2) { animation-delay: 0.15s; }
      .lora-typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes lora-typing-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30% { transform: translateY(-5px); opacity: 1; }
      }

      /* ═══ INPUT AREA ═══ */
      .lora-input-area {
        padding: 12px 14px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 8px;
        background: white;
        align-items: flex-end;
      }
      .lora-input {
        flex: 1;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 10px 14px;
        font-size: 14px;
        font-family: inherit;
        line-height: 1.5;
        outline: none;
        resize: none;
        max-height: 100px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .lora-input:focus {
        border-color: ${primary};
        box-shadow: 0 0 0 3px ${hexToRgba(primary, 0.1)};
      }
      .lora-send {
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px; height: 40px;
        flex-shrink: 0;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 8px ${hexToRgba(primary, 0.25)};
      }
      .lora-send:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 12px ${hexToRgba(primary, 0.35)};
      }
      .lora-send:active:not(:disabled) { transform: scale(0.95); }
      .lora-send:disabled { opacity: 0.4; cursor: not-allowed; }
      .lora-send:focus-visible {
        outline: 2px solid ${primary};
        outline-offset: 2px;
      }

      /* ═══ POWERED BY ═══ */
      .lora-powered {
        text-align: center;
        font-size: 10px;
        color: #94a3b8;
        padding: 6px;
        background: white;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .lora-powered a {
        color: #64748b;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
      }
      .lora-powered a:hover { color: ${primary}; }

      /* ═══ PRE-CHAT FORM ═══ */
      .lora-prechat {
        flex: 1;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        background: #fafafa;
      }
      .lora-prechat-icon {
        width: 48px; height: 48px;
        margin: 8px auto 4px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        box-shadow: 0 6px 18px ${hexToRgba(primary, 0.25)};
      }
      .lora-prechat-msg {
        color: #475569;
        font-size: 14px;
        text-align: center;
        line-height: 1.5;
        margin-bottom: 8px;
      }
      .lora-prechat input {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        font-size: 14px;
        font-family: inherit;
        outline: none;
        background: white;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .lora-prechat input:focus {
        border-color: ${primary};
        box-shadow: 0 0 0 3px ${hexToRgba(primary, 0.1)};
      }
      .lora-prechat button {
        background: linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%);
        color: white;
        border: none;
        padding: 12px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        margin-top: 6px;
        font-family: inherit;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px ${hexToRgba(primary, 0.25)};
      }
      .lora-prechat button:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px ${hexToRgba(primary, 0.35)};
      }

      /* ═══ MOBILE ═══ */
      @media (max-width: 480px) {
        .lora-pos-br, .lora-pos-bl { bottom: 16px; right: 16px; left: auto; }
        .lora-pos-bl { right: auto; left: 16px; }
        .lora-panel {
          position: fixed;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0;
          transform-origin: center bottom;
        }
        .lora-input { font-size: 16px; /* evita zoom en iOS */ }
      }

      /* ═══ REDUCED MOTION ═══ */
      @media (prefers-reduced-motion: reduce) {
        .lora-launcher,
        .lora-panel,
        .lora-msg,
        .lora-typing,
        .lora-welcome {
          animation: none !important;
        }
        .lora-launcher:hover { transform: scale(1.04); }
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
      root.className = `lora-root lora-pos-${state.config.position === 'bottom-left' ? 'bl' : 'br'}`
      document.body.appendChild(root)
    }

    const badgeHtml = state.unreadCount > 0
      ? `<span class="lora-badge" aria-label="${state.unreadCount} mensajes sin leer">${state.unreadCount > 9 ? '9+' : state.unreadCount}</span>`
      : ''

    root.innerHTML = `
      <button class="lora-launcher" id="lora-launcher"
              aria-label="${state.open ? 'Cerrar chat' : 'Abrir chat'}"
              aria-expanded="${state.open}">
        <span aria-hidden="true">${escapeHtml(state.config.launcherIcon || '💬')}</span>
        ${badgeHtml}
      </button>
      ${state.open ? renderPanel() : ''}
    `

    document.getElementById('lora-launcher').onclick = toggleOpen

    if (state.open) {
      const closeBtn = document.getElementById('lora-close')
      if (closeBtn) closeBtn.onclick = toggleOpen

      if (needsPreChat() && !state.preChatDone) {
        bindPreChatForm()
      } else {
        bindInput()
      }

      // Escape cierra el panel (accessibility)
      document.addEventListener('keydown', handleEscape)
    } else {
      document.removeEventListener('keydown', handleEscape)
    }
  }

  function handleEscape(e) {
    if (e.key === 'Escape' && state.open) {
      state.open = false
      render()
    }
  }

  function toggleOpen() {
    state.open = !state.open
    if (state.open) {
      clearNotify()
    }
    render()
    if (state.open) {
      setTimeout(scrollToBottom, 50)
    }
  }

  function renderPanel() {
    const c = state.config
    const showPreChat = needsPreChat() && !state.preChatDone

    return `
      <div class="lora-panel" role="dialog" aria-label="Chat con ${escapeHtml(c.brandName)}">
        <div class="lora-header">
          <div class="lora-header-logo">
            ${c.logoUrl
              ? `<img src="${escapeHtml(c.logoUrl)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`
              : `<span aria-hidden="true">${escapeHtml(c.launcherIcon || '🤖')}</span>`}
          </div>
          <div>
            <div class="lora-header-title">${escapeHtml(c.brandName)}</div>
            <div class="lora-header-subtitle">En línea · Responde rápido</div>
          </div>
          <button class="lora-close" id="lora-close" aria-label="Cerrar chat">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        ${showPreChat ? renderPreChat() : renderChat()}
        ${c.showPoweredBy ? renderPoweredBy() : ''}
      </div>
    `
  }

  function renderPoweredBy() {
    return `<div class="lora-powered">
      <a href="https://lorachat.net" target="_blank" rel="noopener noreferrer">LORA</a>
    </div>`
  }

  function renderPreChat() {
    const c = state.config
    return `
      <div class="lora-prechat">
        <div class="lora-prechat-icon"><span aria-hidden="true">👋</span></div>
        <div class="lora-prechat-msg">${escapeHtml(c.preChatMessage || '¡Hola! Antes de empezar, cuéntanos un poco sobre ti.')}</div>
        <form id="lora-prechat-form">
          ${c.requireName  ? '<input type="text"  name="name"  placeholder="Tu nombre" autocomplete="name" required />' : ''}
          ${c.requireEmail ? '<input type="email" name="email" placeholder="Tu email" autocomplete="email" required />' : ''}
          ${c.requirePhone ? '<input type="tel"   name="phone" placeholder="Tu teléfono" autocomplete="tel" required />' : ''}
          <button type="submit">Iniciar conversación →</button>
        </form>
      </div>
    `
  }

  function renderChat() {
    return `
      <div class="lora-body" id="lora-body" role="log" aria-live="polite">
        ${state.messages.length === 0 ? `
          <div class="lora-welcome">
            <div class="lora-welcome-icon"><span aria-hidden="true">${escapeHtml(state.config.launcherIcon || '👋')}</span></div>
            <div class="lora-welcome-title">${escapeHtml(state.config.welcomeTitle)}</div>
            <div class="lora-welcome-sub">${escapeHtml(state.config.welcomeSubtitle)}</div>
          </div>
        ` : renderMessagesHtml()}
        ${state.sending ? '<div class="lora-typing" aria-label="Escribiendo"><span></span><span></span><span></span></div>' : ''}
      </div>
      <div class="lora-input-area">
        <textarea class="lora-input" id="lora-input" rows="1"
          placeholder="${escapeHtml(state.config.inputPlaceholder)}"
          aria-label="Escribe tu mensaje"
          ${state.sending ? 'disabled' : ''}></textarea>
        <button class="lora-send" id="lora-send" aria-label="Enviar mensaje" ${state.sending ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `
  }

  function renderMessagesHtml() {
    return state.messages.map(m => {
      const cls = `lora-msg lora-msg-${m.sender_type}${m.failed ? ' lora-msg-failed' : ''}`
      return `<div class="${cls}"><div class="lora-bubble">${escapeHtml(m.content)}</div></div>`
    }).join('')
  }

  function renderMessages() {
    const body = document.getElementById('lora-body')
    if (!body) return
    body.innerHTML = state.messages.length === 0 ? `
      <div class="lora-welcome">
        <div class="lora-welcome-icon"><span aria-hidden="true">${escapeHtml(state.config.launcherIcon || '👋')}</span></div>
        <div class="lora-welcome-title">${escapeHtml(state.config.welcomeTitle)}</div>
        <div class="lora-welcome-sub">${escapeHtml(state.config.welcomeSubtitle)}</div>
      </div>
    ` : renderMessagesHtml()
    if (state.sending) {
      body.innerHTML += '<div class="lora-typing" aria-label="Escribiendo"><span></span><span></span><span></span></div>'
    }
  }

  function renderInput() {
    const input = document.getElementById('lora-input')
    const send = document.getElementById('lora-send')
    if (input) input.disabled = state.sending
    if (send) send.disabled = state.sending
    if (input && !state.sending) input.focus()
  }

  function bindInput() {
    const input = document.getElementById('lora-input')
    const send = document.getElementById('lora-send')
    if (!input || !send) return

    // Auto-resize
    const autoResize = () => {
      input.style.height = 'auto'
      input.style.height = Math.min(input.scrollHeight, 100) + 'px'
    }
    input.addEventListener('input', autoResize)

    const doSend = () => {
      const txt = input.value.trim()
      if (!txt) return
      input.value = ''
      input.style.height = 'auto'
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
    const form = document.getElementById('lora-prechat-form')
    if (!form) return
    form.onsubmit = (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      submitPreChat(fd.get('name'), fd.get('email'), fd.get('phone'))
    }
  }

  function scrollToBottom() {
    const body = document.getElementById('lora-body')
    if (body) body.scrollTop = body.scrollHeight
  }

  function notify() {
    state.unreadCount++
    render()
  }

  function clearNotify() {
    state.unreadCount = 0
  }

  // ───── Marcar como cargado y arrancar ─────
  window.__LoraWidget = { state, version: '2.0.0' }
  // Alias de compatibilidad con el nombre viejo durante la migración
  window.__ChatBotIAWidget = window.__LoraWidget

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
