<!-- Ruta: /src/modules/agents/views/UsersView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCan } from '@/composables/useCan'
import { SupabaseUserRepo, type UserWithRoles } from '@/repository/supabase/user.repo'
import { initials } from '@/utils/format'
import InviteUserModal from '../components/InviteUserModal.vue'
import CreateUserModal from '../components/CreateUserModal.vue'
import EditUserRolesModal from '../components/EditUserRolesModal.vue'

const repo = new SupabaseUserRepo()
const auth = useAuthStore()
const { can } = useCan()

const users = ref<UserWithRoles[]>([])
const loading = ref(false)
const search = ref('')
const showInvite = ref(false)
const showCreate = ref(false)
const editingUser = ref<UserWithRoles | null>(null)

const filtered = computed(() =>
  users.value.filter((u) => {
    if (!search.value) return true
    const q = search.value.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.roles.some((r) => r.name.toLowerCase().includes(q))
    )
  })
)

async function load() {
  if (!auth.organizationId) return
  loading.value = true
  try {
    users.value = await repo.listUsers(auth.organizationId)
  } finally {
    loading.value = false
  }
}

async function toggleActive(u: UserWithRoles) {
  if (u.active) await repo.deactivateUser(u.id)
  else await repo.reactivateUser(u.id)
  await load()
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold">Usuarios</h2>
        <p class="text-slate-500 mt-1">Gestiona los miembros de tu organización.</p>
      </div>
      <div class="flex gap-2">
        <button v-can="'users.invite'" class="btn-secondary" @click="showInvite = true">
          ✉️ Invitar por email
        </button>
        <button v-can="'users.create'" class="btn-primary" @click="showCreate = true">
          ➕ Crear usuario
        </button>
      </div>
    </div>

    <div class="card p-4">
      <input v-model="search" class="input" placeholder="Buscar por nombre, email o rol..." />
    </div>

    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface-muted text-slate-600 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Usuario</th>
            <th class="px-4 py-3 font-medium">Roles</th>
            <th class="px-4 py-3 font-medium">Estado</th>
            <th class="px-4 py-3 font-medium">Último acceso</th>
            <th class="px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400">Cargando...</td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400">
              {{ search ? 'Sin resultados' : 'No hay usuarios aún' }}
            </td>
          </tr>
          <tr v-for="u in filtered" :key="u.id" class="hover:bg-surface-muted/50">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-semibold grid place-items-center">
                  {{ initials(u.fullName ?? u.email) }}
                </div>
                <div>
                  <div class="font-medium">{{ u.fullName ?? '—' }}</div>
                  <div class="text-slate-500 text-xs">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="r in u.roles"
                  :key="r.id"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  :style="{ backgroundColor: `${r.color}20`, color: r.color }"
                >
                  <span v-if="r.icon">{{ r.icon }}</span>
                  {{ r.name }}
                </span>
                <span v-if="u.roles.length === 0" class="text-slate-400 text-xs">Sin roles</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                :class="u.active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="u.active ? 'bg-emerald-500' : 'bg-slate-400'" />
                {{ u.active ? 'Activo' : 'Desactivado' }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">
              {{ u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('es') : '—' }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="can('users.assign_roles')"
                class="text-brand-600 hover:underline text-xs mr-3"
                @click="editingUser = u"
              >
                Editar roles
              </button>
              <button
                v-if="can('users.deactivate') && u.id !== auth.user?.id"
                class="text-xs"
                :class="u.active ? 'text-red-600 hover:underline' : 'text-emerald-600 hover:underline'"
                @click="toggleActive(u)"
              >
                {{ u.active ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <InviteUserModal v-if="showInvite" @close="showInvite = false" @created="load" />
    <CreateUserModal v-if="showCreate" @close="showCreate = false" @created="load" />
    <EditUserRolesModal
      v-if="editingUser"
      :user="editingUser"
      @close="editingUser = null"
      @updated="load"
    />
  </div>
</template>
