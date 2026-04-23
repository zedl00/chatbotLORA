<!-- Ruta: /src/layouts/AuthLayout.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Sprint 7 (Rebranding LORA):
       - Panel lateral: gradient mesh animado con logo LORA destacado.
       - Copy actualizado al posicionamiento oficial.
       - Emoji genérico 💬 reemplazado por SVG custom del logomark.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import LoraLogo from '@/components/LoraLogo.vue'
import { useDocumentTitle } from '@/composables/useDocumentTitle'

useDocumentTitle()
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-surface-muted">
    <!-- Panel izquierdo: branding inmersivo -->
    <div class="hidden lg:flex items-center justify-center relative overflow-hidden text-white p-12"
         style="background: linear-gradient(135deg, #0040A0 0%, #0071E3 40%, #06B6D4 100%);">

      <!-- Mesh gradient animado de fondo -->
      <div class="mesh-bg"></div>

      <!-- Grain overlay sutil para textura -->
      <div class="grain-overlay"></div>

      <div class="relative z-10 max-w-md space-y-8">
        <!-- Logomark -->
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9" cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        </div>

        <!-- Wordmark -->
        <LoraLogo size="xl" variant="light" animated />

        <!-- Copy -->
        <div class="space-y-4">
          <h1 class="text-3xl font-bold leading-tight tracking-tight">
            Conversaciones<br>
            que <span class="text-cyan-200">convierten.</span>
          </h1>
          <p class="text-white/75 text-base leading-relaxed">
            Atención omnicanal con IA de verdad. WhatsApp, Instagram, Messenger,
            Telegram y web — una sola bandeja, un solo equipo, cero fricción.
          </p>
        </div>

        <!-- Trust mark pequeño -->
        <div class="flex items-center gap-2 text-white/60 text-xs">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
          Powered by Claude · Made with care in Santo Domingo
        </div>
      </div>
    </div>

    <!-- Panel derecho: formulario -->
    <div class="flex items-center justify-center p-6 lg:p-12 bg-white">
      <div class="w-full max-w-md">
        <!-- Logo móvil (solo visible en pantallas pequeñas) -->
        <div class="lg:hidden mb-8 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl grid place-items-center"
               style="background: linear-gradient(135deg, #0071E3 0%, #06B6D4 50%, #8B5CF6 100%);">
            <span class="text-white font-bold text-lg" style="letter-spacing: -0.05em;">L</span>
          </div>
          <LoraLogo size="md" variant="dark" />
        </div>

        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mesh-bg {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(at 20% 20%, rgba(255,255,255,0.15) 0px, transparent 50%),
    radial-gradient(at 80% 30%, rgba(139, 92, 246, 0.25) 0px, transparent 50%),
    radial-gradient(at 60% 80%, rgba(6, 182, 212, 0.20) 0px, transparent 50%);
  filter: blur(40px);
  animation: mesh-drift 20s ease-in-out infinite;
  pointer-events: none;
}

@keyframes mesh-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(-30px, 20px) scale(1.1); }
  66%      { transform: translate(30px, -20px) scale(0.95); }
}

.grain-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  opacity: 0.05;
  pointer-events: none;
  mix-blend-mode: overlay;
}
</style>
