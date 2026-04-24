<!-- Ruta: /src/layouts/AdminLayout.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 6:
       - Agregado SupportModeBanner arriba del panel
       - Banner solo aparece si super_admin está operando en otra org

     Sprint 5 (mantenido):
       - Sección "LORA Admin" visible solo para role 'super_admin'
       - Header muestra el nombre/logo de la org activa (tenant)
       - Branding dinámico vía organization.store
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useCan } from '@/composables/useCan'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useOrganizationStore } from '@/stores/organization.store'
import LoraLogo from '@/components/LoraLogo.vue'
import SupportModeBanner from '@/components/SupportModeBanner.vue'

const authStore = useAuthStore()
const uiStore = useUiStore()
const orgStore = useOrganizationStore()
const router = useRouter()
const { can } = useCan()

useDocumentTitle()

onMounted(() => {
  orgStore.applyBrandingToDOM()
})

const isSuperAdmin = computed(() => authStore.user?.role === 'super_admin')
const isTenantMode = computed(() => orgStore.isTenant && orgStore.current !== null)

interface NavItem {
  to: string
  label: string
  icon: string
  permission?: string
  section?: string
  superAdminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/admin/dashboard',    label: 'Dashboard',    icon: '📊', permission: 'reports.view' },
  { to: '/admin/inbox',        label: 'Bandeja',      icon: '💬', permission: 'conversations.read' },
  { to: '/admin/contacts',     label: 'Contactos',    icon: '👥', permission: 'contacts.read' },

  { to: '/admin/ai-personas',  label: 'Personalidades IA', icon: '🤖', permission: 'ai.configure', section: 'IA' },
  { to: '/admin/playground',   label: 'Playground',        icon: '🎮', permission: 'ai.configure', section: 'IA' },
  { to: '/admin/knowledge',    label: 'Conocimiento',      icon: '📚', permission: 'knowledge.read', section: 'IA' },

  { to: '/admin/flows',        label: 'Flujos',       icon: '🔀', permission: 'flows.read',     section: 'Configuración' },
  { to: '/admin/channels',     label: 'Canales',      icon: '🔌', permission: 'channels.read',  section: 'Configuración' },
  { to: '/admin/agents',       label: 'Equipo',       icon: '🧑‍💼', permission: 'agents.read',  section: 'Configuración' },
  { to: '/admin/reports',      label: 'Reportes',     icon: '📈', permission: 'reports.view',   section: 'Configuración' },
  { to: '/admin/branding',     label: 'Branding',     icon: '🎨', permission: 'settings.update', section: 'Configuración' },

  { to: '/admin/users',        label: 'Usuarios',     icon: '👤', permission: 'users.read',   section: 'Administración' },
  { to: '/admin/roles',        label: 'Roles',        icon: '🛡️', permission: 'roles.read',    section: 'Administración' },
  { to: '/admin/invitations',  label: 'Invitaciones', icon: '✉️', permission: 'users.invite', section: 'Administración' },
  { to: '/admin/audit',        label: 'Auditoría',    icon: '📋', permission: 'audit.read',   section: 'Administración' },
  { to: '/admin/settings',     label: 'Configuración',icon: '⚙️', permission: 'settings.read', section: 'Administración' },

  { to: '/super-admin/organizations', label: 'Organizaciones', icon: '🏢', section: 'LORA Admin', superAdminOnly: true }
]

const visibleNavGrouped = computed(() => {
  const visible = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin.value) return false
    if (item.permission && !can(item.permission)) return false
    return true
  })

  const groups = new Map<string, NavItem[]>()
  groups.set('', [])

  for (const item of visible) {
    const key = item.section ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return Array.from(groups.entries()).filter(([, items]) => items.length > 0)
})

async function handleSignOut() {
  await authStore.signOut()
  orgStore.clear()
  router.push({ name: 'auth.login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface-muted">
    <!-- 🆕 Sprint 6: Banner de modo soporte arriba de TODO -->
    <SupportModeBanner />

    <div class="flex-1 flex">
      <aside
        class="bg-white border-r border-surface-border transition-all flex flex-col"
        :class="uiStore.sidebarCollapsed ? 'w-16' : 'w-64'"
      >
        <div class="h-16 flex items-center px-4 border-b border-surface-border">
          <div
            v-if="uiStore.sidebarCollapsed"
            class="w-9 h-9 rounded-xl grid place-items-center"
            :style="isTenantMode && orgStore.current
              ? { background: orgStore.primaryColor }
              : { background: 'linear-gradient(135deg, #0071E3 0%, #06B6D4 50%, #8B5CF6 100%)' }"
          >
            <span class="text-white font-bold text-lg" style="letter-spacing: -0.05em;">
              {{ isTenantMode && orgStore.current
                ? (orgStore.displayName.charAt(0).toUpperCase())
                : 'L' }}
            </span>
          </div>

          <template v-else>
            <div v-if="isTenantMode && orgStore.current" class="flex items-center gap-2 min-w-0">
              <img
                v-if="orgStore.current.logoUrl"
                :src="orgStore.current.logoUrl"
                :alt="orgStore.displayName"
                class="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
              <div
                v-else
                class="w-8 h-8 rounded-lg grid place-items-center text-white font-bold text-sm flex-shrink-0"
                :style="{ background: orgStore.primaryColor }"
              >
                {{ orgStore.displayName.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <div class="font-semibold text-slate-900 text-sm truncate">
                  {{ orgStore.displayName }}
                </div>
                <div class="text-[10px] text-slate-400 truncate">
                  en LORA
                </div>
              </div>
            </div>

            <LoraLogo v-else size="md" variant="dark" />
          </template>
        </div>

        <nav class="flex-1 p-2 overflow-auto">
          <div v-for="[section, items] in visibleNavGrouped" :key="section" class="mb-4">
            <div
              v-if="section && !uiStore.sidebarCollapsed"
              class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider"
              :class="section === 'LORA Admin' ? 'text-brand-500' : 'text-slate-400'"
            >
              {{ section }}
            </div>
            <RouterLink
              v-for="item in items"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-surface-muted transition-colors"
              active-class="bg-brand-50 text-brand-700 font-medium"
            >
              <span class="text-lg">{{ item.icon }}</span>
              <span v-if="!uiStore.sidebarCollapsed">{{ item.label }}</span>
            </RouterLink>
          </div>
        </nav>

        <div class="p-2 border-t border-surface-border">
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-surface-muted"
            @click="uiStore.toggleSidebar"
          >
            <span class="text-lg">{{ uiStore.sidebarCollapsed ? '▶' : '◀' }}</span>
            <span v-if="!uiStore.sidebarCollapsed">Colapsar</span>
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-16 bg-white border-b border-surface-border px-6 flex items-center justify-between">
          <h1 class="text-lg font-semibold text-slate-800">{{ $route.meta.title ?? '' }}</h1>

          <div class="flex items-center gap-4">
            <div class="text-right text-sm">
              <div class="font-medium">{{ authStore.user?.fullName ?? authStore.user?.email }}</div>
              <div class="text-slate-500 capitalize text-xs">
                {{ authStore.role?.replace('_', ' ') }}
                <span v-if="isSuperAdmin" class="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-brand-100 text-brand-700 font-semibold uppercase tracking-wide">
                  LORA
                </span>
              </div>
            </div>
            <button class="btn-secondary" @click="handleSignOut">Salir</button>
          </div>
        </header>

        <main class="flex-1 overflow-auto">
          <RouterView />
        </main>
      </div>
    </div>

    <div class="fixed top-4 right-4 space-y-2 z-50">
      <div
        v-for="t in uiStore.toasts"
        :key="t.id"
        class="card px-4 py-3 min-w-[240px] text-sm"
        :class="{
          'border-l-4 border-l-emerald-500': t.type === 'success',
          'border-l-4 border-l-red-500': t.type === 'error',
          'border-l-4 border-l-amber-500': t.type === 'warning',
          'border-l-4 border-l-brand-500': t.type === 'info'
        }"
      >
        {{ t.message }}
      </div>
    </div>
  </div>
</template>
