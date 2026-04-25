/**
 * LORA Chat Widget — Sprint 11.6 v2
 *
 * Fix: El orden de carga era incorrecto. Ahora:
 * 1. Click 💬 → llama startSession() para obtener settings + crear sesión
 * 2. Si los settings indican pre-chat → muestra formulario
 *    (la sesión ya existe; el form solo es para enriquecer visitorData)
 * 3. Si no requiere → muestra chat directo
 *
 * Uso:
 *   <script>window.LoraChat = { channelId: 'uuid' };</script>
 *   <script async src="https://admin.lorachat.net/widget.js"></script>
 */
(function () {
  'use strict'

  var SUPABASE_URL = (typeof window !== 'undefined' && window.LORA_SUPABASE_URL) || 'https://imvahmyywbtcfsduwbdq.supabase.co'
  var SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.LORA_SUPABASE_ANON_KEY) || ''

  var config = (typeof window !== 'undefined' && window.LoraChat) || {}
  if (!config.channelId) {
    console.warn('[LORA] channelId no definido. El widget no puede cargar.')
    return
  }

  // STATE
  var visitorId = ensureVisitorId()
  var sessionId = null
  var conversationId = null
  var settings = null
  var publicConfig = {}
  var aiActive = true
  var chatStarted = false
  var realtimeChannel = null
  var messagesLoaded = []

  var VISITOR_ID_KEY = 'lora_visitor_id'
  var PUBLIC_CONFIG_KEY = 'lora_public_config'
  var PUBLIC_CONFIG_TTL = 5 * 60 * 1000

  // ─────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────
  function ensureVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_ID_KEY)
      if (existing) return existing
      var generated = 'vis_' + uuid()
      localStorage.setItem(VISITOR_ID_KEY, generated)
      return generated
    } catch (e) {
      return 'vis_' + uuid()
    }
  }

  function uuid() {
    var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return template.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      var v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    })
  }

  // ─────────────────────────────────────────────────────
  // PUBLIC CONFIG (URLs y branding global)
  // ─────────────────────────────────────────────────────
  async function fetchPublicConfig() {
    try {
      var cached = localStorage.getItem(PUBLIC_CONFIG_KEY)
      if (cached) {
        var parsed = JSON.parse(cached)
        if (Date.now() - parsed.ts < PUBLIC_CONFIG_TTL) {
          publicConfig = parsed.data || {}
          return
        }
      }
    } catch (e) {}

    try {
      var headers = SUPABASE_ANON_KEY ? { 'apikey': SUPABASE_ANON_KEY } : {}
      var res = await fetch(SUPABASE_URL + '/functions/v1/public-config', { headers: headers })
      if (res.ok) {
        publicConfig = await res.json()
        try {
          localStorage.setItem(PUBLIC_CONFIG_KEY, JSON.stringify({ ts: Date.now(), data: publicConfig }))
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[LORA] public-config no disponible')
    }
  }

  // ─────────────────────────────────────────────────────
  // API: widget-session
  // ─────────────────────────────────────────────────────
  async function startSession(visitorData) {
    var body = {
      channelId: config.channelId,
      visitorId: visitorId,
      visitorData: visitorData || {}
    }
    body.visitorData.currentUrl = body.visitorData.currentUrl || window.location.href
    body.visitorData.referrer = body.visitorData.referrer || document.referrer || null
    body.visitorData.userAgent = body.visitorData.userAgent || navigator.userAgent

    var headers = { 'Content-Type': 'application/json' }
    if (SUPABASE_ANON_KEY) headers['apikey'] = SUPABASE_ANON_KEY

    var res = await fetch(SUPABASE_URL + '/functions/v1/widget-session', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      var err = await res.json().catch(function () { return {} })
      throw new Error(err.error || ('widget-session ' + res.status))
    }

    var data = await res.json()
    sessionId = data.sessionId
    conversationId = data.conversationId
    settings = data.config || {}
    aiActive = data.aiActive !== false
    messagesLoaded = data.messages || []

    console.log('[LORA] Settings cargados:', settings)
    return data
  }

  // ─────────────────────────────────────────────────────
  // API: widget-message
  // ─────────────────────────────────────────────────────
  async function sendMessage(text) {
    var headers = { 'Content-Type': 'application/json' }
    if (SUPABASE_ANON_KEY) headers['apikey'] = SUPABASE_ANON_KEY

    var res = await fetch(SUPABASE_URL + '/functions/v1/widget-message', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ sessionId: sessionId, message: text })
    })

    if (!res.ok) {
      var err = await res.json().catch(function () { return {} })
      if (res.status === 403 && err.error === 'contact_blocked') {
        addMessage('bot', err.message || 'No podemos procesar tu mensaje en este momento.')
        return null
      }
      throw new Error(err.error || ('widget-message ' + res.status))
    }
    return res.json()
  }

  // ─────────────────────────────────────────────────────
  // API: widget-csat
  // ─────────────────────────────────────────────────────
  async function sendCSAT(rating, feedback) {
    var headers = { 'Content-Type': 'application/json' }
    if (SUPABASE_ANON_KEY) headers['apikey'] = SUPABASE_ANON_KEY

    await fetch(SUPABASE_URL + '/functions/v1/widget-csat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        conversation_id: conversationId,
        rating: rating,
        feedback: feedback
      })
    })
  }

  // ─────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────
  function brandingDefault() {
    return {
      primaryColor: '#0071E3',
      accentColor: '#0071E3',
      position: 'right',
      brandName: publicConfig.brand_name || 'Asistente',
      logoUrl: null,
      welcomeTitle: '¡Hola! ¿En qué podemos ayudarte?',
      welcomeSubtitle: 'Te respondemos en minutos',
      inputPlaceholder: 'Escribe tu mensaje...',
      offlineMessage: 'Estamos fuera de línea. Déjanos un mensaje.',
      launcherIcon: '💬',
      requireName: false,
      requireEmail: false,
      requirePhone: false,
      preChatMessage: null,
      autoOpen: false,
      autoOpenDelayMs: 0,
      showPoweredBy: true
    }
  }

  function injectStyles() {
    var s = Object.assign(brandingDefault(), settings || {})
    var color = s.primaryColor || '#0071E3'
    var pos = s.position === 'left' ? 'left' : 'right'

    var css = [
      "#lora-chat-root *, #lora-chat-root *::before, #lora-chat-root *::after { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      "#lora-chat-fab { position: fixed; " + pos + ": 20px; bottom: 20px; width: 60px; height: 60px; border-radius: 50%; background: " + color + "; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999998; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: none; font-size: 28px; transition: transform 0.2s; }",
      "#lora-chat-fab:hover { transform: scale(1.05); }",
      "#lora-chat-window { position: fixed; " + pos + ": 20px; bottom: 100px; width: 380px; height: 560px; max-height: calc(100vh - 120px); background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); display: none; flex-direction: column; z-index: 999999; overflow: hidden; }",
      "#lora-chat-window.open { display: flex; animation: lora-slide-up 0.3s ease-out; }",
      "@keyframes lora-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }",
      "#lora-chat-header { padding: 16px; background: " + color + "; color: white; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }",
      "#lora-chat-header-logo { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 600; overflow: hidden; }",
      "#lora-chat-header-logo img { width: 100%; height: 100%; object-fit: cover; }",
      "#lora-chat-close { margin-left: auto; background: transparent; border: none; color: white; cursor: pointer; font-size: 18px; opacity: 0.8; padding: 4px; }",
      "#lora-chat-close:hover { opacity: 1; }",
      "#lora-chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; }",
      ".lora-msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; word-wrap: break-word; white-space: pre-wrap; }",
      ".lora-msg-contact { background: " + color + "; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }",
      ".lora-msg-bot, .lora-msg-agent { background: white; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }",
      "#lora-chat-input-row { padding: 12px; border-top: 1px solid #e2e8f0; background: white; display: flex; gap: 8px; flex-shrink: 0; }",
      "#lora-chat-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 8px 14px; font-size: 14px; outline: none; }",
      "#lora-chat-input:focus { border-color: " + color + "; }",
      "#lora-chat-send { background: " + color + "; color: white; border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 16px; flex-shrink: 0; }",
      "#lora-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }",
      ".lora-form { padding: 24px 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; background: #f8f9fa; overflow-y: auto; }",
      ".lora-form-title { font-size: 17px; font-weight: 600; color: #1e293b; margin: 0; }",
      ".lora-form-subtitle { font-size: 13px; color: #64748b; margin: 0 0 8px 0; }",
      ".lora-form-field { display: flex; flex-direction: column; gap: 4px; }",
      ".lora-form-label { font-size: 12px; color: #475569; font-weight: 500; }",
      ".lora-form-label .lora-req { color: #ef4444; margin-left: 2px; }",
      ".lora-form-input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; background: white; width: 100%; }",
      ".lora-form-input:focus { border-color: " + color + "; }",
      ".lora-form-button { margin-top: 8px; padding: 12px; background: " + color + "; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }",
      ".lora-form-button:hover { filter: brightness(1.05); }",
      ".lora-form-error { color: #ef4444; font-size: 12px; margin-top: -2px; }",
      ".lora-thank-you { padding: 40px 20px; text-align: center; background: #f8f9fa; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }",
      ".lora-thank-you-emoji { font-size: 48px; }",
      ".lora-thank-you-text { font-size: 16px; color: #334155; font-weight: 500; }",
      ".lora-powered-by { padding: 6px 12px; text-align: center; font-size: 10px; color: #94a3b8; background: white; border-top: 1px solid #f1f5f9; }",
      ".lora-powered-by a { color: " + color + "; text-decoration: none; }",
      ".lora-loading { padding: 40px 20px; text-align: center; color: #94a3b8; flex: 1; display: flex; align-items: center; justify-content: center; }"
    ].join('\n')

    var existing = document.getElementById('lora-chat-styles')
    if (existing) existing.remove()
    var styleEl = document.createElement('style')
    styleEl.id = 'lora-chat-styles'
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  var root

  function ensureRoot() {
    root = document.getElementById('lora-chat-root')
    if (!root) {
      root = document.createElement('div')
      root.id = 'lora-chat-root'
      document.body.appendChild(root)
    }
  }

  function renderFab() {
    var s = Object.assign(brandingDefault(), settings || {})
    root.innerHTML =
      '<button id="lora-chat-fab" aria-label="Abrir chat">' + escapeHtml(s.launcherIcon || '💬') + '</button>' +
      '<div id="lora-chat-window" role="dialog" aria-label="Chat"></div>'
    document.getElementById('lora-chat-fab').onclick = toggleWindow
  }

  function renderHeader() {
    var s = Object.assign(brandingDefault(), settings || {})
    var initial = (s.brandName || 'L').charAt(0).toUpperCase()
    return [
      '<div id="lora-chat-header">',
      '  <div id="lora-chat-header-logo">',
      s.logoUrl ? '<img src="' + escapeHtml(s.logoUrl) + '" alt="' + escapeHtml(s.brandName) + '"/>' : escapeHtml(initial),
      '  </div>',
      '  <div style="display:flex;flex-direction:column;">',
      '    <strong style="font-size:14px;">' + escapeHtml(s.brandName) + '</strong>',
      '    <span style="font-size:11px;opacity:0.8;">' + (aiActive ? 'En línea' : 'Conectándote con un agente') + '</span>',
      '  </div>',
      '  <button id="lora-chat-close" aria-label="Cerrar">✕</button>',
      '</div>'
    ].join('')
  }

  function renderPoweredBy() {
    var s = Object.assign(brandingDefault(), settings || {})
    if (!s.showPoweredBy) return ''
    return '<div class="lora-powered-by">Powered by <a href="' + (publicConfig.landing_url || 'https://lorachat.net') + '" target="_blank">' + escapeHtml(publicConfig.brand_name || 'LORA') + '</a></div>'
  }

  function attachHeaderClose() {
    var btn = document.getElementById('lora-chat-close')
    if (btn) btn.onclick = toggleWindow
  }

  function renderLoading() {
    var w = document.getElementById('lora-chat-window')
    w.innerHTML = renderHeader() + '<div class="lora-loading">Cargando...</div>'
    attachHeaderClose()
  }

  // ─────────────────────────────────────────────────────
  // PRE-CHAT
  // ─────────────────────────────────────────────────────
  function needsPreChat() {
    if (!settings) return false
    return !!(settings.requireName || settings.requireEmail || settings.requirePhone)
  }

  function renderPreChatForm() {
    var s = Object.assign(brandingDefault(), settings || {})
    var w = document.getElementById('lora-chat-window')
    var fields = []

    if (s.requireName) fields.push({ key: 'name', label: 'Nombre', type: 'text' })
    if (s.requireEmail) fields.push({ key: 'email', label: 'Email', type: 'email' })
    if (s.requirePhone) fields.push({ key: 'phone', label: 'Teléfono', type: 'tel' })

    var fieldsHtml = fields.map(function (f) {
      return '<div class="lora-form-field">' +
        '<label class="lora-form-label">' + escapeHtml(f.label) + '<span class="lora-req">*</span></label>' +
        '<input type="' + f.type + '" class="lora-form-input" data-field="' + f.key + '" required/>' +
        '</div>'
    }).join('')

    var preMsg = s.preChatMessage
      ? '<p class="lora-form-subtitle">' + escapeHtml(s.preChatMessage) + '</p>'
      : '<p class="lora-form-subtitle">Cuéntanos un poco antes de empezar</p>'

    w.innerHTML = renderHeader() +
      '<form class="lora-form" id="lora-prechat-form">' +
      '  <h3 class="lora-form-title">' + escapeHtml(s.welcomeTitle) + '</h3>' +
      preMsg +
      fieldsHtml +
      '  <div id="lora-form-error" class="lora-form-error" style="display:none;"></div>' +
      '  <button type="submit" class="lora-form-button">Iniciar conversación</button>' +
      '</form>' + renderPoweredBy()

    attachHeaderClose()
    document.getElementById('lora-prechat-form').onsubmit = handlePreChatSubmit

    // Focus en el primer campo
    var firstInput = w.querySelector('input[data-field]')
    if (firstInput) firstInput.focus()
  }

  async function handlePreChatSubmit(e) {
    e.preventDefault()
    var form = e.target
    var data = {}
    var s = Object.assign(brandingDefault(), settings || {})
    var fields = []
    if (s.requireName) fields.push({ key: 'name', label: 'Nombre', validate: function (v) { return v.length > 0 } })
    if (s.requireEmail) fields.push({ key: 'email', label: 'Email', validate: function (v) { return /^\S+@\S+\.\S+$/.test(v) } })
    if (s.requirePhone) fields.push({ key: 'phone', label: 'Teléfono', validate: function (v) { return v.length >= 6 } })

    for (var i = 0; i < fields.length; i++) {
      var f = fields[i]
      var el = form.querySelector('[data-field="' + f.key + '"]')
      var val = (el.value || '').trim()
      if (!val || !f.validate(val)) {
        showFormError('Por favor completa correctamente: ' + f.label)
        return
      }
      data[f.key] = val
    }

    try {
      // Re-llamar startSession con los datos del visitante
      // Esto actualiza el contacto existente con nombre/email/teléfono
      await startSession(data)
      chatStarted = true
      renderChatUI()
      subscribeRealtime()
    } catch (err) {
      showFormError(err.message || 'Error iniciando chat')
    }
  }

  function showFormError(msg) {
    var el = document.getElementById('lora-form-error')
    if (el) {
      el.textContent = msg
      el.style.display = 'block'
    }
  }

  // ─────────────────────────────────────────────────────
  // CHAT UI
  // ─────────────────────────────────────────────────────
  function renderChatUI() {
    var s = Object.assign(brandingDefault(), settings || {})
    var w = document.getElementById('lora-chat-window')

    w.innerHTML = renderHeader() +
      '<div id="lora-chat-body"></div>' +
      '<div id="lora-chat-input-row">' +
      '  <input id="lora-chat-input" type="text" placeholder="' + escapeHtml(s.inputPlaceholder) + '"/>' +
      '  <button id="lora-chat-send" aria-label="Enviar">→</button>' +
      '</div>' + renderPoweredBy()

    attachHeaderClose()

    // Cargar mensajes existentes (visita recurrente con conversación abierta)
    if (messagesLoaded.length > 0) {
      messagesLoaded.forEach(function (m) {
        addMessage(m.sender_type, m.content)
      })
    } else {
      // Primera vez: bienvenida del bot
      var welcome = s.welcomeTitle
      if (s.welcomeSubtitle) welcome += '\n' + s.welcomeSubtitle
      addMessage('bot', welcome)
    }

    var input = document.getElementById('lora-chat-input')
    var sendBtn = document.getElementById('lora-chat-send')
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    })
    sendBtn.onclick = handleSend
    input.focus()
  }

  async function handleSend() {
    var input = document.getElementById('lora-chat-input')
    var text = (input.value || '').trim()
    if (!text) return
    addMessage('contact', text)
    input.value = ''
    input.focus()

    try {
      var res = await sendMessage(text)
      if (!res) return

      if (res.botMessage && res.botMessage.content) {
        addMessage('bot', res.botMessage.content)
      } else if (res.botError) {
        addMessage('bot', '⚠️ ' + res.botError)
      } else if (res.awaitingHuman) {
        addMessage('bot', 'Un agente te responderá pronto.')
      }
    } catch (e) {
      console.error('[LORA] Error enviando mensaje:', e)
      addMessage('bot', '⚠️ No se pudo enviar. Inténtalo de nuevo.')
    }
  }

  function addMessage(senderType, content) {
    var body = document.getElementById('lora-chat-body')
    if (!body) return
    var el = document.createElement('div')
    el.className = 'lora-msg lora-msg-' + senderType
    el.textContent = content
    body.appendChild(el)
    body.scrollTop = body.scrollHeight
  }

  // ─────────────────────────────────────────────────────
  // REALTIME
  // ─────────────────────────────────────────────────────
  function subscribeRealtime() {
    if (!conversationId) return
    if (window.supabase && window.supabase.createClient) {
      doSubscribe()
      return
    }
    var s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
    s.onload = doSubscribe
    document.head.appendChild(s)
  }

  function doSubscribe() {
    if (!window.supabase || !SUPABASE_ANON_KEY) return
    if (realtimeChannel) {
      try { realtimeChannel.unsubscribe() } catch (e) {}
    }
    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    realtimeChannel = client.channel('widget-' + conversationId)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'conversation_id=eq.' + conversationId
        },
        function (payload) {
          var msg = payload.new
          if (msg.sender_type === 'agent') {
            addMessage('agent', msg.content)
          }
        }
      ).subscribe()
  }

  // ─────────────────────────────────────────────────────
  // OPEN / CLOSE — FLUJO CORRECTO
  // ─────────────────────────────────────────────────────
  async function toggleWindow() {
    var w = document.getElementById('lora-chat-window')
    if (w.classList.contains('open')) {
      w.classList.remove('open')
      return
    }
    await openWindow()
  }

  async function openWindow() {
    var w = document.getElementById('lora-chat-window')
    w.classList.add('open')

    // Si ya estaba el chat iniciado en esta sesión de pestaña, mostrar directo
    if (chatStarted) {
      renderChatUI()
      return
    }

    // Mostrar loader mientras carga settings
    renderLoading()

    try {
      // 1. Cargar settings + sesión
      await startSession({})

      // 2. Inyectar estilos con los settings ya cargados (color correcto, etc.)
      injectStyles()
      // Re-renderizar el FAB con el icono correcto
      var fab = document.getElementById('lora-chat-fab')
      if (fab && settings && settings.launcherIcon) {
        fab.textContent = settings.launcherIcon
      }

      // 3. Decidir: pre-chat o chat directo
      if (needsPreChat()) {
        console.log('[LORA] Mostrando pre-chat porque settings tiene requireName/Email/Phone')
        renderPreChatForm()
      } else {
        console.log('[LORA] Sin pre-chat, abriendo chat directo')
        chatStarted = true
        renderChatUI()
        subscribeRealtime()
      }
    } catch (e) {
      console.error('[LORA] Error iniciando chat:', e)
      showFatalError(e.message || 'No se pudo iniciar el chat')
    }
  }

  function showFatalError(msg) {
    var w = document.getElementById('lora-chat-window')
    w.innerHTML = renderHeader() +
      '<div class="lora-thank-you">' +
      '  <div class="lora-thank-you-emoji">⚠️</div>' +
      '  <div class="lora-thank-you-text">' + escapeHtml(msg) + '</div>' +
      '</div>'
    attachHeaderClose()
  }

  function closeAndReset() {
    var w = document.getElementById('lora-chat-window')
    if (w) w.classList.remove('open')
    if (realtimeChannel) {
      try { realtimeChannel.unsubscribe() } catch (e) {}
      realtimeChannel = null
    }
  }

  // ─────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────
  async function init() {
    ensureRoot()
    await fetchPublicConfig()
    injectStyles()
    renderFab()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.LoraChatAPI = {
    open: function () { openWindow() },
    close: closeAndReset,
    sendCSAT: sendCSAT,
    reset: function () {
      try { localStorage.removeItem(VISITOR_ID_KEY) } catch (e) {}
      try { localStorage.removeItem(PUBLIC_CONFIG_KEY) } catch (e) {}
      sessionId = null
      conversationId = null
      chatStarted = false
      visitorId = ensureVisitorId()
      console.log('[LORA] Visitor reseteado:', visitorId)
    }
  }
})()
