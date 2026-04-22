<!-- Ruta: /src/modules/auth/views/ChangePasswordView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  error.value = null

  if (newPassword.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  submitting.value = true
  try {
    await auth.updatePassword(newPassword.value)
    router.push({ name: 'admin.dashboard' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar contraseña'
  } finally {
    submitting.value = false
  }
}

async function handleSignOut() {
  await auth.signOut()
  router.push({ name: 'auth.login' })
}
</script>

<template>
  <div class="space-y-5">
    <div class="w-14 h-14 rounded-full bg-amber-50 text-amber-600 grid place-items-center text-3xl mx-auto">
      🔐
    </div>

    <div class="text-center">
      <h2 class="text-2xl font-bold">Actualiza tu contraseña</h2>
      <p class="text-slate-500 mt-2">
        Tu cuenta fue creada con una contraseña temporal. Por seguridad, debes establecer una nueva antes de continuar.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
        <input v-model="newPassword" type="password" required minlength="8" class="input" placeholder="Mínimo 8 caracteres" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Confirmar nueva contraseña</label>
        <input v-model="confirmPassword" type="password" required class="input" />
      </div>

      <div v-if="error" class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
        {{ error }}
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Actualizando...' : 'Guardar y continuar' }}
      </button>

      <button type="button" class="text-sm text-slate-500 hover:underline w-full text-center" @click="handleSignOut">
        Cerrar sesión
      </button>
    </form>
  </div>
</template>
