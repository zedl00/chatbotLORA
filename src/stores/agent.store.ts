// Ruta: /src/stores/agent.store.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 8 · Entrega 3
// Store del agente LOGUEADO (mi propio registro en la tabla agents).
//
// Se carga al hacer login y se actualiza con:
//   - heartbeat automático (cada 60s)
//   - cambio manual de status
//   - detección de inactividad (5 min → away)
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SupabaseAgentRepo } from '@/repository/supabase/agent.repo'
import type { Agent, AgentStatus } from '@/types/agent.types'

const repo = new SupabaseAgentRepo()

export const useAgentStore = defineStore('agent', () => {
  // ── STATE ──────────────────────────────────────────────
  const myAgent = ref<Agent | null>(null)
  const loading = ref(false)

  // ── GETTERS ────────────────────────────────────────────
  const status = computed<AgentStatus>(() => myAgent.value?.status ?? 'offline')
  const statusMessage = computed(() => myAgent.value?.statusMessage ?? null)
  const isOnline = computed(() => status.value === 'online')
  const isAway = computed(() => status.value === 'away')
  const isBusy = computed(() => status.value === 'busy')
  const isOffline = computed(() => status.value === 'offline')

  // ── ACTIONS ────────────────────────────────────────────

  async function loadMyAgent(userId: string) {
    loading.value = true
    try {
      myAgent.value = await repo.getMyAgent(userId)
    } catch (e) {
      console.error('[agent.store] Error cargando agent:', e)
      myAgent.value = null
    } finally {
      loading.value = false
    }
  }

  async function sendHeartbeat(userId: string) {
    try {
      await repo.heartbeat(userId)
      // Si estaba away/offline y heartbeat lo pasó a online, refrescar
      if (myAgent.value && (myAgent.value.status === 'away' || myAgent.value.status === 'offline')) {
        myAgent.value = { ...myAgent.value, status: 'online', lastActivityAt: new Date().toISOString() }
      } else if (myAgent.value) {
        myAgent.value = { ...myAgent.value, lastActivityAt: new Date().toISOString() }
      }
    } catch (e) {
      // Los heartbeats no son críticos; logueamos pero no rompemos
      console.warn('[agent.store] Heartbeat falló:', e)
    }
  }

  async function setStatus(
    userId: string,
    newStatus: AgentStatus,
    message: string | null = null
  ) {
    try {
      await repo.setStatus(userId, newStatus, message)
      if (myAgent.value) {
        myAgent.value = {
          ...myAgent.value,
          status: newStatus,
          statusMessage: message,
          statusChangedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString()
        }
      }
    } catch (e) {
      console.error('[agent.store] Error cambiando status:', e)
      throw e
    }
  }

  /**
   * Marcar offline cuando el user hace logout o cierra la ventana.
   */
  async function markOffline(userId: string) {
    try {
      await repo.setStatus(userId, 'offline', null)
    } catch {
      // ignorar errores de cleanup
    }
  }

  function clear() {
    myAgent.value = null
  }

  return {
    // state
    myAgent,
    loading,
    // getters
    status,
    statusMessage,
    isOnline,
    isAway,
    isBusy,
    isOffline,
    // actions
    loadMyAgent,
    sendHeartbeat,
    setStatus,
    markOffline,
    clear
  }
})
