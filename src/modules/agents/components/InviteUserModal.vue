<!-- Ruta: /src/modules/agents/components/InviteUserModal.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseRbacRepo } from '@/repository/supabase/rbac.repo'
import { supabase } from '@/services/supabase.client'
import type { Role } from '@/types/rbac.types'

const emit = defineEmits<{
  close: []
  created: []
}>()

const auth = useAuthStore()
const rbacRepo = new SupabaseRbacRepo()

const roles = ref<Role[]>([])
const email = ref('')
const roleId = ref('')
const message = ref('')
const inviteLink = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  if (!auth.organizationId) return
  const all = await rbacRepo.listRoles(auth.organizationId)
  // No permitir invitar como super_admin por defecto
  roles.value = all.filter((r) => r.key !== 'super_admin')
}

async function handleSubmit() {
  error.value = null
  loading.value = true
  try {
    const { data, error: fnErr } = await supabase.functions.invoke('user-invite', {
      body: {
        email: email.value.trim(),
        roleId: roleId.value,
        message: message.value.trim() || undefined
      }
    })
    if (fnErr) throw fnErr
    inviteLink.value = data?.inviteLink ?? null
    emit('created')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al enviar invitación'
  } finally {
    loading.value = false
  }
}

function copyLink() {
  if (inviteLink.value) {
    navigator.clipboard.writeText(inviteLink.value)
  }
}

onMounted(load)
</script>

<template>
  <div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-pop max-w-md w-full p-6 space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-bold">Invitar usuario</h3>
          <p class="text-slate-500 text-sm">Le enviaremos un enlace para que elija su contraseña.</p>
        </div>
        <button class="text-slate-400 hover:text-slate-600 text-xl" @click="emit('close')">✕</button>
      </div>

      <div v-if="inviteLink" class="space-y-3">
        <div class="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-xl">
          ✅ Invitación creada. Si el email no llegó, comparte este enlace manualmente:
        </div>
        <div class="flex gap-2">
          <input readonly :value="inviteLink" class="input text-xs" />
          <button class="btn-secondary shrink-0" @click="copyLink">📋 Copiar</button>
        </div>
        <button class="btn-primary w-full" @click="emit('close')">Cerrar</button>
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <input v-model="email" type="email" required class="input" placeholder="persona@empresa.com" />
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
          <label class="block text-sm font-medium mb-1">
            Mensaje personal <span class="text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea v-model="message" class="input" rows="3" placeholder="¡Bienvenido al equipo!" />
        </div>
        <div v-if="error" class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{{ error }}</div>
        <div class="flex gap-2 justify-end pt-2">
          <button type="button" class="btn-secondary" @click="emit('close')">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Enviando...' : 'Enviar invitación' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
