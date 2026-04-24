// Ruta: /src/stores/escalations.store.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 9 · Store de escalamientos activos
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SupabaseSupervisorRepo } from '@/repository/supabase/supervisor.repo'
import type { Escalation } from '@/types/supervisor.types'

const repo = new SupabaseSupervisorRepo()

export const useEscalationsStore = defineStore('escalations', () => {
  // ── STATE ──────────────────────────────────────────────
  const active = ref<Escalation[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const currentOrgId = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  // ── GETTERS ────────────────────────────────────────────
  const count = computed(() => active.value.length)
  const slaBreaches = computed(() =>
    active.value.filter((e) => e.type === 'sla_breach')
  )
  const byConversation = computed(() => {
    const map = new Map<string, Escalation[]>()
    for (const e of active.value) {
      if (!map.has(e.conversationId)) map.set(e.conversationId, [])
      map.get(e.conversationId)!.push(e)
    }
    return map
  })

  function hasActiveFor(conversationId: string): boolean {
    return byConversation.value.has(conversationId)
  }

  function getForConversation(conversationId: string, type?: Escalation['type']): Escalation[] {
    const list = byConversation.value.get(conversationId) ?? []
    return type ? list.filter((e) => e.type === type) : list
  }

  // ── ACTIONS ────────────────────────────────────────────

  async function load(organizationId: string, force = false) {
    if (loaded.value && currentOrgId.value === organizationId && !force) return
    loading.value = true
    try {
      active.value = await repo.listActive(organizationId)
      loaded.value = true
      currentOrgId.value = organizationId
    } catch (e) {
      console.error('[escalations.store] Error cargando:', e)
      active.value = []
    } finally {
      loading.value = false
    }
  }

  function subscribe(organizationId: string) {
    if (unsubscribe) unsubscribe()
    // 🔧 Fix build: el parámetro no se usa porque recargamos la lista completa.
    // TypeScript estricto con noUnusedParameters requiere prefijo _ para ignorar.
    unsubscribe = repo.subscribeToEscalations(organizationId, async (_row) => {
      // Nuevo/actualizado: recargamos la lista. Es barato (<50 items).
      if (currentOrgId.value === organizationId) {
        await load(organizationId, true)
      }
    })
  }

  async function resolveManually(escalationId: string) {
    try {
      await repo.markResolved(escalationId)
      active.value = active.value.filter((e) => e.id !== escalationId)
    } catch (e) {
      console.error('[escalations.store] Error resolviendo:', e)
      throw e
    }
  }

  function clear() {
    active.value = []
    loaded.value = false
    currentOrgId.value = null
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return {
    // state
    active,
    loading,
    loaded,
    // getters
    count,
    slaBreaches,
    byConversation,
    hasActiveFor,
    getForConversation,
    // actions
    load,
    subscribe,
    resolveManually,
    clear
  }
})
