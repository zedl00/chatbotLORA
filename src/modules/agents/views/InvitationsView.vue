<!-- Ruta: /src/modules/agents/views/InvitationsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import type { InvitationWithRole } from '@/types/rbac.types'

const auth = useAuthStore()
const repo = new SupabaseRbacRepo()

const invitations = ref<InvitationWithRole[]>([])
const loading = ref(false)

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

async function load() {
  if (!auth.organizationId) return
  loading.value = true
  try {
    invitations.value = await repo.listInvitations(auth.organizationId)
  } finally {
    loading.value = false
  }
}

async function revoke(id: string) {
  if (!confirm('¿Revocar esta invitación?')) return
  await repo.revokeInvitation(id)
  await load()
}

function copyLink(token: string) {
  navigator.clipboard.writeText(`${APP_URL}/auth/accept-invite?token=${token}`)
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pendiente' },
    accepted: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aceptada' },
    revoked:  { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Revocada' },
    expired:  { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Expirada' }
  }
  return map[status] ?? map.pending
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <h2 class="text-2xl font-bold">Invitaciones</h2>
      <p class="text-slate-500 mt-1">Historial de invitaciones enviadas.</p>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface-muted text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Email</th>
            <th class="px-4 py-3 font-medium">Rol</th>
            <th class="px-4 py-3 font-medium">Invitado por</th>
            <th class="px-4 py-3 font-medium">Estado</th>
            <th class="px-4 py-3 font-medium">Enviada</th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400">Cargando...</td>
          </tr>
          <tr v-else-if="invitations.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400">Sin invitaciones aún.</td>
          </tr>
          <tr v-for="inv in invitations" :key="inv.id" class="hover:bg-surface-muted/50">
            <td class="px-4 py-3 font-medium">{{ inv.email }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                :style="{ backgroundColor: `${inv.role.color}20`, color: inv.role.color }"
              >
                <span v-if="inv.role.icon">{{ inv.role.icon }}</span>
                {{ inv.role.name }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ inv.inviter?.fullName ?? inv.inviter?.email ?? '—' }}
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="`${statusBadge(inv.status).bg} ${statusBadge(inv.status).text}`"
              >
                {{ statusBadge(inv.status).label }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500 text-xs">
              {{ new Date(inv.createdAt).toLocaleDateString('es') }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="inv.status === 'pending'"
                class="text-brand-600 hover:underline text-xs mr-3"
                @click="copyLink(inv.token)"
              >
                Copiar link
              </button>
              <button
                v-if="inv.status === 'pending'"
                class="text-red-600 hover:underline text-xs"
                @click="revoke(inv.id)"
              >
                Revocar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
