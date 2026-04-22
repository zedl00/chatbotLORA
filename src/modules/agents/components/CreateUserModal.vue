<!-- Ruta: /src/modules/agents/components/CreateUserModal.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import { supabase } from '@/services/supabase.client'
import type { Role } from '@/types/rbac.types'

const emit = defineEmits<{ close: []; created: [] }>()

const auth = useAuthStore()
const rbacRepo = new SupabaseRbacRepo()

const roles = ref<Role[]>([])
const email = ref('')
const fullName = ref('')
const roleId = ref('')
const tempPassword = ref('')
const created = ref<{ email: string; password: string } | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint8Array(14)
  crypto.getRandomValues(buf)
  for (const b of buf) out += chars[b % chars.length]
  tempPassword.value = out + '#'
}

async function load() {
  if (!auth.organizationId) return
  const all = await rbacRepo.listRoles(auth.organizationId)
  roles.value = all.filter((r) => r.key !== 'super_admin')
}

async function handleSubmit() {
  error.value = null
  loading.value = true
  try {
    const { data, error: fnErr } = await supabase.functions.invoke('user-create', {
      body: {
        email: email.value.trim(),
        fullName: fullName.value.trim(),
        roleId: roleId.value,
        temporaryPassword: tempPassword.value || undefined
      }
    })
    if (fnErr) throw fnErr
    created.value = { email: data.email, password: data.temporaryPassword }
    emit('created')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al crear usuario'
  } finally {
    loading.value = false
  }
}

function copyCreds() {
  if (created.value) {
    navigator.clipboard.writeText(
      `Email: ${created.value.email}\nContraseña temporal: ${created.value.password}`
    )
  }
}

onMounted(() => { load(); generatePassword() })
</script>

<template>
  <div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-pop max-w-md w-full p-6 space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-bold">Crear usuario</h3>
          <p class="text-slate-500 text-sm">Se creará con contraseña temporal que debe cambiar al primer login.</p>
        </div>
        <button class="text-slate-400 hover:text-slate-600 text-xl" @click="emit('close')">✕</button>
      </div>

      <div v-if="created" class="space-y-3">
        <div class="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-xl">
          ✅ Usuario creado. Copia estas credenciales y entrégalas de forma segura:
        </div>
        <div class="bg-slate-50 rounded-xl p-3 font-mono text-xs space-y-1">
          <div><strong>Email:</strong> {{ created.email }}</div>
          <div><strong>Contraseña:</strong> {{ created.password }}</div>
        </div>
        <button class="btn-secondary w-full" @click="copyCreds">📋 Copiar credenciales</button>
        <button class="btn-primary w-full" @click="emit('close')">Cerrar</button>
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="block text-sm font-medium mb-1">Nombre completo</label>
          <input v-model="fullName" required class="input" placeholder="Ana Pérez" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <input v-model="email" type="email" required class="input" placeholder="ana@empresa.com" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Rol</label>
          <select v-model="roleId" required class="input">
            <option value="" disabled>Selecciona un rol</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">
              {{ r.icon }} {{ r.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Contraseña temporal</label>
          <div class="flex gap-2">
            <input v-model="tempPassword" required class="input font-mono" minlength="8" />
            <button type="button" class="btn-secondary shrink-0" @click="generatePassword">
              🎲 Generar
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            El usuario debe cambiarla al iniciar sesión por primera vez.
          </p>
        </div>
        <div v-if="error" class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{{ error }}</div>
        <div class="flex gap-2 justify-end pt-2">
          <button type="button" class="btn-secondary" @click="emit('close')">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Creando...' : 'Crear usuario' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
