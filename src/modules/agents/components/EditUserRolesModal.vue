<!-- Ruta: /src/modules/agents/components/EditUserRolesModal.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import type { Role } from '@/types/rbac.types'
import type { UserWithRoles } from '@/repository/supabase/user.repo'

const props = defineProps<{ user: UserWithRoles }>()
const emit = defineEmits<{ close: []; updated: [] }>()

const auth = useAuthStore()
const repo = new SupabaseRbacRepo()

const allRoles = ref<Role[]>([])
const currentRoleIds = ref<Set<string>>(new Set())
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  if (!auth.organizationId) return

  const [roles, userRoles] = await Promise.all([
    repo.listRoles(auth.organizationId),
    repo.getUserRoles(props.user.id)
  ])

  allRoles.value = roles
  currentRoleIds.value = new Set(userRoles.map((ur) => ur.role.id))
}

async function toggleRole(role: Role) {
  error.value = null
  loading.value = true

  try {
    if (currentRoleIds.value.has(role.id)) {
      // Revocar
      const userRoles = await repo.getUserRoles(props.user.id)
      const target = userRoles.find((ur) => ur.role.id === role.id)
      if (target) {
        await repo.revokeUserRole(target.id)
        currentRoleIds.value.delete(role.id)
      }
    } else {
      // Asignar
      if (!auth.organizationId) return
      await repo.assignRoleToUser({
        userId: props.user.id,
        roleId: role.id,
        organizationId: auth.organizationId
      })
      currentRoleIds.value.add(role.id)
    }
    emit('updated')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-pop max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-auto">
      <div class="flex items-start justify-between sticky top-0 bg-white pb-2">
        <div>
          <h3 class="text-lg font-bold">Roles de {{ user.fullName ?? user.email }}</h3>
          <p class="text-slate-500 text-sm">Un usuario puede tener múltiples roles.</p>
        </div>
        <button class="text-slate-400 hover:text-slate-600 text-xl" @click="emit('close')">✕</button>
      </div>

      <div v-if="error" class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{{ error }}</div>

      <div class="space-y-2">
        <div
          v-for="role in allRoles"
          :key="role.id"
          class="border border-surface-border rounded-xl p-3 flex items-start gap-3 transition-colors"
          :class="currentRoleIds.has(role.id) ? 'border-brand-300 bg-brand-50/40' : ''"
        >
          <input
            type="checkbox"
            :checked="currentRoleIds.has(role.id)"
            :disabled="loading || role.key === 'super_admin'"
            class="mt-1"
            @change="toggleRole(role)"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                :style="{ backgroundColor: `${role.color}20`, color: role.color }"
              >
                <span v-if="role.icon">{{ role.icon }}</span>
                {{ role.name }}
              </span>
              <span v-if="role.isSystem" class="text-xs text-slate-400">· Sistema</span>
            </div>
            <p v-if="role.description" class="text-slate-500 text-xs mt-1">{{ role.description }}</p>
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button class="btn-primary" @click="emit('close')">Listo</button>
      </div>
    </div>
  </div>
</template>
