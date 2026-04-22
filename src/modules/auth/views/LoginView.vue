<!-- Ruta: /src/modules/auth/views/LoginView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  error.value = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
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

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          v-model="email"
          type="email"
          required
          class="input"
          placeholder="tucorreo@empresa.com"
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
