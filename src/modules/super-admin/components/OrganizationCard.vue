<!-- Ruta: /src/modules/super-admin/components/OrganizationCard.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Card individual de una organización en la lista del super admin.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { OrganizationWithStats } from '@/types/organization.types'

interface Props {
  org: OrganizationWithStats
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'toggleActive', org: OrganizationWithStats): void
  (e: 'open', org: OrganizationWithStats): void
}>()

const subdomainUrl = computed(() => {
  return props.org.subdomain
    ? `https://${props.org.subdomain}.lorachat.net`
    : null
})

const createdAgo = computed(() => {
  if (!props.org.createdAt) return ''
  const date = new Date(props.org.createdAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 30) return `Hace ${diffDays} días`
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`
  return `Hace ${Math.floor(diffDays / 365)} años`
})

const brandInitial = computed(() => {
  return (props.org.brandName ?? props.org.name).trim().charAt(0).toUpperCase()
})
</script>

<template>
  <div class="bg-white border border-surface-border rounded-xl overflow-hidden hover:shadow-md transition-all">
    <!-- Header con color de la marca -->
    <div class="h-16 flex items-center gap-3 px-4 relative"
         :style="{ background: `linear-gradient(135deg, ${org.primaryColor}15, ${org.primaryColor}08)` }">
      <div
        class="w-10 h-10 rounded-xl grid place-items-center text-white font-bold text-lg flex-shrink-0"
        :style="{ background: org.primaryColor }"
      >
        {{ brandInitial }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-slate-900 truncate">{{ org.name }}</div>
        <div v-if="org.subdomain" class="text-xs text-slate-500 font-mono truncate">
          {{ org.subdomain }}.lorachat.net
        </div>
      </div>

      <!-- Badge de estado -->
      <span
        class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex-shrink-0"
        :class="org.active
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-500'"
      >
        {{ org.active ? 'Activa' : 'Desactivada' }}
      </span>
    </div>

    <!-- Métricas -->
    <div class="grid grid-cols-3 divide-x divide-surface-border border-t border-surface-border">
      <div class="p-3 text-center">
        <div class="text-xl font-bold text-slate-900">{{ org.userCount }}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Usuarios</div>
      </div>
      <div class="p-3 text-center">
        <div class="text-xl font-bold text-slate-900">{{ org.conversationCount }}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Chats</div>
      </div>
      <div class="p-3 text-center">
        <div class="text-xs font-semibold text-slate-700 uppercase">{{ org.plan }}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Plan</div>
      </div>
    </div>

    <!-- Footer con acciones -->
    <div class="px-3 py-2.5 border-t border-surface-border bg-slate-50 flex items-center justify-between gap-2">
      <span class="text-[11px] text-slate-500">{{ createdAgo }}</span>

      <div class="flex gap-1">
        <a
          v-if="subdomainUrl && org.active"
          :href="subdomainUrl"
          target="_blank"
          rel="noopener"
          class="text-xs px-2 py-1 rounded-md bg-white border border-surface-border text-slate-600 hover:bg-slate-100 transition-colors"
          title="Abrir panel en nueva pestaña"
        >
          Abrir ↗
        </a>
        <button
          class="text-xs px-2 py-1 rounded-md transition-colors"
          :class="org.active
            ? 'bg-white border border-surface-border text-amber-600 hover:bg-amber-50'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
          @click="emit('toggleActive', org)"
        >
          {{ org.active ? 'Desactivar' : 'Activar' }}
        </button>
      </div>
    </div>
  </div>
</template>
