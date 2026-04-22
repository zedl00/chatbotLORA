<!-- Ruta: /src/modules/auth/views/ForgotPasswordView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const email = ref('')
const sent = ref(false)
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  error.value = null
  loading.value = true
  try {
    await authStore.sendPasswordReset(email.value)
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">Recuperar contraseña</h2>
      <p class="text-slate-500 mt-1">Te enviaremos un enlace a tu correo.</p>
    </div>

    <form v-if="!sent" class="space-y-4" @submit.prevent="handleSubmit">
      <input v-model="email" type="email" required class="input" placeholder="tucorreo@empresa.com" />
      <div v-if="error" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ error }}</div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Enviando…' : 'Enviar enlace' }}
      </button>
    </form>

    <div v-else class="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
      Te enviamos un correo con las instrucciones.
    </div>

    <div class="text-center">
      <RouterLink to="/auth/login" class="text-sm text-brand-600 hover:underline">
        Volver a iniciar sesión
      </RouterLink>
    </div>
  </div>
</template>
