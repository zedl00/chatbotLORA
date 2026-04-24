<!-- Ruta: /src/modules/channels/components/EmptyChannelsState.vue -->
<script setup lang="ts">
defineEmits<{ (e: 'create'): void }>()
</script>

<template>
  <div class="bg-white border border-surface-border rounded-2xl p-12 text-center">
    <div class="text-6xl mb-4">🔌</div>
    <h3 class="text-xl font-bold text-slate-800 mb-2">Aún no tienes canales activos</h3>
    <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">
      Los canales son las vías por donde recibes conversaciones. Empieza creando un widget web para tu sitio.
    </p>
    <button
      class="btn-primary"
      @click="$emit('create')"
    >
      + Crear primer canal
    </button>

    <div class="mt-8 pt-8 border-t border-surface-border">
      <p class="text-xs text-slate-400 mb-3">También puedes conectar:</p>
      <div class="flex gap-3 justify-center flex-wrap">
        <span class="text-xs px-3 py-1 rounded-full bg-slate-50 border border-surface-border text-slate-600">📱 WhatsApp</span>
        <span class="text-xs px-3 py-1 rounded-full bg-slate-50 border border-surface-border text-slate-600">✈️ Telegram</span>
        <span class="text-xs px-3 py-1 rounded-full bg-slate-50 border border-surface-border text-slate-600">📷 Instagram</span>
        <span class="text-xs px-3 py-1 rounded-full bg-slate-50 border border-surface-border text-slate-600">✉️ Email</span>
      </div>
    </div>
  </div>
</template>
