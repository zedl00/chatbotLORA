<!-- Ruta: /src/modules/auth/views/LoginView.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 5 (Multi-tenant):
       - Después del signIn exitoso, verifica si el usuario debe ser
         redirigido a su subdomain real (patrón login universal).
       - super_admin se queda donde esté.
       - admin/supervisor/agent se redirigen a {empresa}.lorachat.net.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { redirectToTenantIfNeeded } from '@/composables/useTenantRedirect'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

// Mensaje de error si viene del query (ej: redirects del guard)
const queryError = ref<string | null>(null)

onMounted(() => {
  const err = route.query.error as string | undefined
  if (err === 'wrong_org') {
    queryError.value = 'No tienes acceso a esta empresa. Por favor inicia sesión de nuevo.'
  } else if (err === 'org_not_found') {
    const sub = route.query.subdomain as string | undefined
    queryError.value = sub
      ? `La empresa "${sub}" no existe o está desactivada.`
      : 'La empresa no existe o está desactivada.'
  }
})

async function handleSubmit() {
  error.value = null
  queryError.value = null
  loading.value = true

  try {
    // 1. Autenticar contra Supabase
    await authStore.signIn(email.value, password.value)

    // 2. Si el user es de una empresa con subdomain distinto, redirigir
    if (authStore.user) {
      const redirected = await redirectToTenantIfNeeded(authStore.user)
      if (redirected) {
        // window.location.href ya se disparó. No hacer más nada.
        // (Mantenemos loading=true para que no parpadee el form)
        return
      }
    }

    // 3. Si no hubo redirect, navegar normal dentro del mismo dominio
    const redirect = (route.query.redirect as string) || '/admin/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
      <p class="text-slate-500 mt-1">Accede al panel con tu cuenta.</p>
    </div>

    <!-- Mensaje de error si viene del guard -->
    <div v-if="queryError" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
      {{ queryError }}
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          v-model="email"
          type="email"
          required
          class="input"
          placeholder="tucorreo@empresa.com"
          autocomplete="email"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
        <input
          v-model="password"
          type="password"
          required
          class="input"
          placeholder="••••••••"
          autocomplete="current-password"
        />
      </div>

      <div v-if="error" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
        {{ error }}
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Iniciando…' : 'Ingresar' }}
      </button>
    </form>

    <div class="text-center">
      <RouterLink to="/auth/forgot-password" class="text-sm text-brand-600 hover:underline">
        ¿Olvidaste tu contraseña?
      </RouterLink>
    </div>
  </div>
</template>