// Ruta: /src/stores/quick-reply.store.ts
// ═══════════════════════════════════════════════════════════════
// Sprint 8 · Entrega 4
// Store de quick replies para compartir data entre:
//   - QuickRepliesView (gestión)
//   - QuickReplyDropdown (inserción con /)
//   - QuickReplyButton (botón manual)
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SupabaseQuickReplyRepo } from '@/repository/supabase/quick-reply.repo'
import type {
  QuickReply,
  CreateQuickReplyInput,
  UpdateQuickReplyInput
} from '@/types/agent.types'

const repo = new SupabaseQuickReplyRepo()

export const useQuickReplyStore = defineStore('quickReply', () => {
  // ── STATE ──────────────────────────────────────────────
  const items = ref<QuickReply[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const lastOrgId = ref<string | null>(null)

  // ── GETTERS ────────────────────────────────────────────

  /** Los del usuario actual (personales) */
  function myPersonal(userId: string) {
    return computed(() =>
      items.value.filter((qr) => qr.ownerId === userId && !qr.isShared)
    )
  }

  /** Las compartidas de la org */
  const shared = computed(() =>
    items.value.filter((qr) => qr.isShared)
  )

  /** Todas las visibles para el usuario (personales + compartidas) */
  function visibleFor(userId: string) {
    return computed(() =>
      items.value.filter(
        (qr) => qr.isShared || qr.ownerId === userId
      )
    )
  }

  /**
   * Busca quick replies por shortcut que empiecen con un prefix.
   * Usado por el dropdown de '/'.
   */
  function searchByShortcut(userId: string, prefix: string): QuickReply[] {
    const p = prefix.trim().toLowerCase()
    if (!p) {
      return items.value
        .filter((qr) => qr.isShared || qr.ownerId === userId)
        .slice(0, 10)
    }
    return items.value
      .filter((qr) => qr.isShared || qr.ownerId === userId)
      .filter((qr) => qr.shortcut.startsWith(p))
      .slice(0, 10)
  }

  // ── ACTIONS ────────────────────────────────────────────

  async function load(organizationId: string, force = false) {
    if (loaded.value && lastOrgId.value === organizationId && !force) return
    loading.value = true
    try {
      items.value = await repo.listMine(organizationId)
      loaded.value = true
      lastOrgId.value = organizationId
    } catch (e) {
      console.error('[quick-reply.store] Error cargando:', e)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateQuickReplyInput): Promise<QuickReply> {
    const created = await repo.create(input)
    items.value.push(created)
    return created
  }

  async function update(id: string, input: UpdateQuickReplyInput): Promise<QuickReply> {
    const updated = await repo.update(id, input)
    const idx = items.value.findIndex((qr) => qr.id === id)
    if (idx >= 0) items.value[idx] = updated
    return updated
  }

  async function remove(id: string): Promise<void> {
    await repo.delete(id)
    items.value = items.value.filter((qr) => qr.id !== id)
  }

  /**
   * Se llama al insertar un quick reply desde el editor.
   * Incrementa el contador de uso y la posición local.
   */
  async function recordUsage(id: string) {
    try {
      await repo.incrementUsage(id)
      const idx = items.value.findIndex((qr) => qr.id === id)
      if (idx >= 0) {
        items.value[idx] = {
          ...items.value[idx],
          usageCount: items.value[idx].usageCount + 1
        }
      }
    } catch {
      // no crítico
    }
  }

  function clear() {
    items.value = []
    loaded.value = false
    lastOrgId.value = null
  }

  return {
    // state
    items,
    loading,
    loaded,
    // getters
    shared,
    myPersonal,
    visibleFor,
    searchByShortcut,
    // actions
    load,
    create,
    update,
    remove,
    recordUsage,
    clear
  }
})
