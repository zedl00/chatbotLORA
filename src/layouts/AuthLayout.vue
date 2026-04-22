<!-- Ruta: /src/layouts/AuthLayout.vue -->
<script setup lang="ts"></script>

<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-surface-muted">
    <div class="hidden lg:flex items-center justify-center bg-brand-600 text-white p-12">
      <div class="max-w-md space-y-6">
        <div class="w-14 h-14 rounded-2xl bg-white/10 grid place-items-center text-3xl">💬</div>
        <h1 class="text-4xl font-bold leading-tight">ChatBot IA Empresarial</h1>
        <p class="text-white/80 text-lg leading-relaxed">
          Atención omnicanal con inteligencia artificial.
          WhatsApp, Instagram, Messenger, Telegram y más — en una sola bandeja.
        </p>
      </div>
    </div>

    <div class="flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </div>
  </div>
</template>
