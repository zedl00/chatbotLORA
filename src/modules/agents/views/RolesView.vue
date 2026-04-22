<!-- Ruta: /src/modules/agents/views/RolesView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import type { Permission, Role, RoleWithPermissions, PermissionScope } from '@/types/rbac.types'

const auth = useAuthStore()
const repo = new SupabaseRbacRepo()

const roles = ref<Role[]>([])
const selectedRole = ref<RoleWithPermissions | null>(null)
const allPermissions = ref<Permission[]>([])
const loading = ref(false)
const showCreateForm = ref(false)

// Para crear/editar rol
const form = ref({
  name: '',
  key: '',
  description: '',
  color: '#2b7bff',
  icon: '⭐',
  permissions: new Map<string, PermissionScope>()
})

const permissionsByCategory = computed(() => {
  const groups = new Map<string, Permission[]>()
  for (const p of allPermissions.value) {
    if (!groups.has(p.category)) groups.set(p.category, [])
    groups.get(p.category)!.push(p)
  }
  return Array.from(groups.entries())
})

async function load() {
  if (!auth.organizationId) return
  loading.value = true
  try {
    const [rolesList, perms] = await Promise.all([
      repo.listRoles(auth.organizationId),
      repo.getAllPermissions()
    ])
    roles.value = rolesList
    allPermissions.value = perms
  } finally {
    loading.value = false
  }
}

async function selectRole(r: Role) {
  selectedRole.value = null
  const full = await repo.getRoleWithPermissions(r.id)
  selectedRole.value = full
  // Poblar form
  if (full) {
    form.value = {
      name: full.name,
      key: full.key,
      description: full.description ?? '',
      color: full.color,
      icon: full.icon ?? '⭐',
      permissions: new Map(full.permissions.map((p) => [p.permission.id, p.scope]))
    }
  }
  showCreateForm.value = false
}

function startCreate() {
  selectedRole.value = null
  showCreateForm.value = true
  form.value = {
    name: '',
    key: '',
    description: '',
    color: '#2b7bff',
    icon: '⭐',
    permissions: new Map()
  }
}

function togglePermission(p: Permission, scope: PermissionScope) {
  const current = form.value.permissions.get(p.id)
  if (current === scope) {
    form.value.permissions.delete(p.id)
  } else {
    form.value.permissions.set(p.id, scope)
  }
  // Forzar reactividad
  form.value.permissions = new Map(form.value.permissions)
}

async function save() {
  if (!auth.organizationId) return
  const permissions = Array.from(form.value.permissions.entries()).map(
    ([permissionId, scope]) => ({ permissionId, scope })
  )

  if (showCreateForm.value) {
    await repo.createRole({
      organizationId: auth.organizationId,
      key: form.value.key || form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      name: form.value.name,
      description: form.value.description,
      color: form.value.color,
      icon: form.value.icon,
      permissions
    })
  } else if (selectedRole.value) {
    await repo.updateRole(selectedRole.value.id, {
      name: form.value.name,
      description: form.value.description,
      color: form.value.color,
      icon: form.value.icon
    })
    await repo.updateRolePermissions(selectedRole.value.id, permissions)
  }

  await load()
  if (selectedRole.value) await selectRole(selectedRole.value)
  showCreateForm.value = false
}

async function deleteRole() {
  if (!selectedRole.value || selectedRole.value.isSystem) return
  if (!confirm(`¿Eliminar el rol "${selectedRole.value.name}"? Los usuarios con este rol perderán sus permisos.`)) return
  await repo.deleteRole(selectedRole.value.id)
  selectedRole.value = null
  await load()
}

onMounted(load)
</script>

<template>
  <div class="flex h-full">
    <!-- Panel izquierdo: lista de roles -->
    <aside class="w-72 border-r border-surface-border bg-white overflow-auto">
      <div class="p-4 border-b border-surface-border">
        <button v-can="'roles.create'" class="btn-primary w-full" @click="startCreate">
          ➕ Nuevo rol
        </button>
      </div>

      <div class="p-2 space-y-1">
        <button
          v-for="r in roles"
          :key="r.id"
          class="w-full text-left p-3 rounded-xl hover:bg-surface-muted transition-colors"
          :class="selectedRole?.id === r.id ? 'bg-brand-50 border border-brand-200' : ''"
          @click="selectRole(r)"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ r.icon }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ r.name }}</div>
              <div class="text-xs text-slate-500">
                {{ r.isSystem ? 'Sistema' : 'Personalizado' }}
              </div>
            </div>
          </div>
        </button>
      </div>
    </aside>

    <!-- Panel derecho: detalle del rol -->
    <main class="flex-1 overflow-auto p-6">
      <div v-if="!selectedRole && !showCreateForm" class="text-center text-slate-400 mt-20">
        Selecciona un rol para ver sus permisos o crea uno nuevo.
      </div>

      <div v-else class="max-w-3xl space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-bold">
              {{ showCreateForm ? 'Nuevo rol' : `Rol: ${selectedRole?.name}` }}
            </h2>
            <p v-if="selectedRole?.isSystem" class="text-amber-600 text-sm mt-1">
              ⚠️ Rol del sistema. Solo puedes ver sus permisos; no se puede editar ni eliminar.
            </p>
          </div>
          <div v-if="selectedRole && !selectedRole.isSystem" class="flex gap-2">
            <button v-can="'roles.delete'" class="btn-secondary text-red-600" @click="deleteRole">
              Eliminar
            </button>
          </div>
        </div>

        <!-- Formulario de datos del rol -->
        <div v-if="showCreateForm || (selectedRole && !selectedRole.isSystem)" class="card p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">Nombre</label>
              <input v-model="form.name" class="input" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Icono</label>
              <input v-model="form.icon" class="input" maxlength="2" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Descripción</label>
            <textarea v-model="form.description" class="input" rows="2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Color</label>
            <input v-model="form.color" type="color" class="h-10 w-20" />
          </div>
        </div>

        <!-- Permisos por categoría -->
        <div class="space-y-4">
          <h3 class="font-semibold">Permisos ({{ form.permissions.size }})</h3>

          <div
            v-for="[category, perms] in permissionsByCategory"
            :key="category"
            class="card overflow-hidden"
          >
            <div class="bg-surface-muted px-4 py-2 text-sm font-medium">{{ category }}</div>
            <div class="divide-y divide-surface-border">
              <div
                v-for="p in perms"
                :key="p.id"
                class="px-4 py-3 flex items-center gap-3"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-slate-500">{{ p.key }}</span>
                    <span
                      v-if="p.isDangerous"
                      class="text-[10px] text-red-600 bg-red-50 px-1.5 rounded"
                    >⚠️ peligroso</span>
                  </div>
                  <p class="text-sm">{{ p.description }}</p>
                </div>
                <div class="flex items-center gap-1">
                  <template v-if="p.scopeable">
                    <button
                      v-for="s in ['own', 'team', 'all'] as const"
                      :key="s"
                      :disabled="selectedRole?.isSystem"
                      class="text-xs px-2 py-1 rounded border transition-colors"
                      :class="form.permissions.get(p.id) === s
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-surface-border hover:bg-surface-muted'"
                      @click="togglePermission(p, s)"
                    >{{ s }}</button>
                  </template>
                  <button
                    v-else
                    :disabled="selectedRole?.isSystem"
                    class="text-xs px-3 py-1 rounded border transition-colors"
                    :class="form.permissions.has(p.id)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-surface-border hover:bg-surface-muted'"
                    @click="togglePermission(p, 'all')"
                  >{{ form.permissions.has(p.id) ? '✓' : '+' }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!selectedRole?.isSystem" class="sticky bottom-0 bg-white border-t border-surface-border py-4">
          <button class="btn-primary" @click="save">
            {{ showCreateForm ? 'Crear rol' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
