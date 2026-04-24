// Ruta: /src/composables/usePresence.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 8 · Entrega 3
// Presence del agente logueado:
//   - Cada 60s envía heartbeat → mantiene "online"
//   - Detecta inactividad: si 5 min sin mouse/teclado → "away" automático
//   - Al volver a moverse → "online" automático (vía el heartbeat)
//   - Al desmontar → "offline" (usuario cerró la ventana o logout)
//
// Se usa UNA SOLA VEZ en el root (AdminLayout) para todo el panel.
// ═══════════════════════════════════════════════════════════════
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useAgentStore } from '@/stores/agent.store'

const HEARTBEAT_INTERVAL_MS = 60_000           // 60 segundos
const INACTIVITY_TIMEOUT_MS = 5 * 60_000       // 5 minutos

export function usePresence() {
  const auth = useAuthStore()
  const agentStore = useAgentStore()

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null
  let lastActivityTs = Date.now()

  // ─── Heartbeat ─────────────────────────────────────────
  async function sendHeartbeat() {
    if (!auth.user?.id) return

    // Si el user NO estaba activo (5 min sin mover), no lo pongamos online.
    const inactiveMs = Date.now() - lastActivityTs
    if (inactiveMs > INACTIVITY_TIMEOUT_MS) {
      // Estamos en idle: no mandamos heartbeat
      return
    }

    await agentStore.sendHeartbeat(auth.user.id)
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // ─── Inactividad ───────────────────────────────────────
  function resetInactivityTimer() {
    lastActivityTs = Date.now()
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }
    inactivityTimer = setTimeout(() => {
      // 5 min sin actividad → marcar como away
      if (auth.user?.id && agentStore.isOnline) {
        agentStore.setStatus(auth.user.id, 'away')
      }
    }, INACTIVITY_TIMEOUT_MS)
  }

  function handleUserActivity() {
    const wasIdle = Date.now() - lastActivityTs > INACTIVITY_TIMEOUT_MS
    lastActivityTs = Date.now()

    // Si estaba en "away" y volvió a moverse → enviar heartbeat inmediato
    // El RPC de heartbeat ya lo pasa a "online" automáticamente
    if (wasIdle && auth.user?.id && agentStore.isAway) {
      agentStore.sendHeartbeat(auth.user.id)
    }

    resetInactivityTimer()
  }

  const activityEvents: Array<keyof WindowEventMap> = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll'
  ]

  function attachActivityListeners() {
    for (const ev of activityEvents) {
      window.addEventListener(ev, handleUserActivity, { passive: true })
    }
  }

  function detachActivityListeners() {
    for (const ev of activityEvents) {
      window.removeEventListener(ev, handleUserActivity)
    }
  }

  // ─── Beforeunload: marcar offline al cerrar ventana ────
  function handleBeforeUnload() {
    if (!auth.user?.id) return
    // sendBeacon NO existe para RPC custom, así que fetch directo
    // NOTA: puede no alcanzar a enviarse si el tab cierra muy rápido;
    // es un best-effort. Si falla, agents_auto_away() lo marcará away
    // después, y el offline automático es manejable desde el front.
    try {
      agentStore.markOffline(auth.user.id)
    } catch {
      /* noop */
    }
  }

  // ─── Visibility: si el usuario cambia de pestaña ──────
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      handleUserActivity()
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────
  onMounted(async () => {
    if (!auth.user?.id) return

    // Cargar mi agent record si no está cargado
    if (!agentStore.myAgent) {
      await agentStore.loadMyAgent(auth.user.id)
    }

    // Enviar heartbeat inmediato para marcar "online"
    await sendHeartbeat()

    // Arrancar timers
    startHeartbeat()
    resetInactivityTimer()

    // Listeners
    attachActivityListeners()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeUnmount(() => {
    stopHeartbeat()
    if (inactivityTimer) clearTimeout(inactivityTimer)
    detachActivityListeners()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)

    // Cleanup: marcar offline si sigo autenticado
    if (auth.user?.id) {
      agentStore.markOffline(auth.user.id)
    }
  })

  // Si el usuario cambia (ej: logout + login), recargar agent
  watch(
    () => auth.user?.id,
    async (newId) => {
      if (newId) {
        await agentStore.loadMyAgent(newId)
        await sendHeartbeat()
      } else {
        agentStore.clear()
      }
    }
  )

  return {
    sendHeartbeat,
    resetInactivityTimer
  }
}
