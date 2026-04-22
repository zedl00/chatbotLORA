<!-- Ruta: /src/modules/auth/views/AcceptInviteView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/services/supabase.client'
import { useAuthStore } from '@/stores/auth.store'

interface InviteDetails {
  email: string
  organizationName: string
  roleName: string
  inviterName: string | null
  expiresAt: string
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = ref<string>((route.query.token as string) ?? '')
const details = ref<InviteDetails | null>(null)
const loadingInvite = ref(true)
const invalidReason = ref<string | null>(null)

const fullName = ref('')
const password = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const success = ref(false)

/**
 * Carga los detalles de la invitación usando la policy pública
 * de la tabla invitations: cualquiera con el token puede leer su propia invitación.
 * (Ver nota en RBAC_INTEGRATION.md sobre la policy adicional necesaria.)
 */
async function loadInvite() {
  if (!token.value) {
    invalidReason.value = 'No se proporcionó un token de invitación.'
    loadingInvite.value = false
    return
  }

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        email, status, expires_at,
        role:roles(name),
        org:organizations(name),
        inviter:users!invitations_invited_by_fkey(full_name)
      `)
      .eq('token', token.value)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      invalidReason.value = 'Esta invitación no existe o fue revocada.'
      return
    }

    if (data.status !== 'pending') {
      const statusLabels: Record<string, string> = {
        accepted: 'Esta invitación ya fue aceptada.',
        revoked: 'Esta invitación fue revocada.',
        expired: 'Esta invitación expiró.'
      }
      invalidReason.value = statusLabels[data.status] ?? 'Invitación inválida.'
      return
    }

    if (new Date(data.expires_at) < new Date()) {
      invalidReason.value = 'Esta invitación expiró. Solicita una nueva.'
      return
    }

    const role = Array.isArray(data.role) ? data.role[0] : data.role
    const org = Array.isArray(data.org) ? data.org[0] : data.org
    const inviter = Array.isArray(data.inviter) ? data.inviter[0] : data.inviter

    details.value = {
      email: data.email,
      organizationName: org?.name ?? 'la organización',
      roleName: role?.name ?? 'miembro',
      inviterName: inviter?.full_name ?? null,
      expiresAt: data.expires_at
    }
  } catch (e) {
    invalidReason.value = e instanceof Error ? e.message : 'Error al cargar la invitación'
  } finally {
    loadingInvite.value = false
  }
}

async function handleAccept() {
  submitError.value = null

  if (password.value.length < 8) {
    submitError.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (password.value !== passwordConfirm.value) {
    submitError.value = 'Las contraseñas no coinciden.'
    return
  }

  submitting.value = true
  try {
    const { data, error } = await supabase.functions.invoke('user-accept-invite', {
      body: {
        token: token.value,
        password: password.value,
        fullName: fullName.value.trim() || undefined
      }
    })
    if (error) throw error
    if (!data?.userId) throw new Error('Respuesta inválida del servidor')

    success.value = true

    // Intentar auto-login
    if (details.value) {
      await supabase.auth.signInWithPassword({
        email: details.value.email,
        password: password.value
      })
      await auth.initialize()
      setTimeout(() => router.push('/admin/dashboard'), 1200)
    }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Error al aceptar invitación'
  } finally {
    submitting.value = false
  }
}

onMounted(loadInvite)
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loadingInvite" class="text-center py-8">
      <div class="text-slate-500">Validando invitación...</div>
    </div>

    <!-- Invalid -->
    <div v-else-if="invalidReason" class="space-y-4">
      <div class="w-14 h-14 rounded-full bg-red-50 text-red-600 grid place-items-center text-3xl mx-auto">
        ⚠️
      </div>
      <div class="text-center">
        <h2 class="text-xl font-bold text-slate-900">Invitación inválida</h2>
        <p class="text-slate-600 mt-2">{{ invalidReason }}</p>
      </div>
      <RouterLink to="/auth/login" class="btn-secondary w-full text-center block">
        Ir a iniciar sesión
      </RouterLink>
    </div>

    <!-- Success -->
    <div v-else-if="success" class="space-y-4 text-center">
      <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center text-3xl mx-auto">
        ✅
      </div>
      <div>
        <h2 class="text-xl font-bold">¡Bienvenido!</h2>
        <p class="text-slate-600 mt-2">Te estamos redirigiendo al panel...</p>
      </div>
    </div>

    <!-- Form -->
    <div v-else-if="details" class="space-y-5">
      <div>
        <h2 class="text-2xl font-bold">Únete a {{ details.organizationName }}</h2>
        <p class="text-slate-500 mt-1">
          <span v-if="details.inviterName">
            <strong>{{ details.inviterName }}</strong> te invitó
          </span>
          <span v-else>Te invitaron</span>
          como <strong class="text-brand-700">{{ details.roleName }}</strong>.
        </p>
      </div>

      <div class="bg-brand-50 border border-brand-200 rounded-xl p-3 text-sm">
        Email: <strong>{{ details.email }}</strong>
      </div>

      <form class="space-y-4" @submit.prevent="handleAccept">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
          <input v-model="fullName" required class="input" placeholder="Tu nombre" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
          <input v-model="password" type="password" required minlength="8" class="input" placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
          <input v-model="passwordConfirm" type="password" required class="input" />
        </div>

        <div v-if="submitError" class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {{ submitError }}
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="submitting">
          {{ submitting ? 'Creando cuenta...' : 'Aceptar e ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>
