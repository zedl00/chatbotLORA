<!-- Ruta: /src/components/LoraLogo.vue -->
<!--
  Logo oficial de LORA.
  Uso:
    <LoraLogo />                          → tamaño md, variante dark
    <LoraLogo size="lg" variant="light"/> → en headers dark
    <LoraLogo size="xl" animated />       → hero / login con pulse animado
-->
<script setup lang="ts">
interface Props {
  variant?: 'dark' | 'light' | 'blue' | 'gradient'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'dark',
  size: 'md',
  animated: false
})
</script>

<template>
  <span
    class="lora-wordmark"
    :class="[`variant-${variant}`, `size-${size}`, { animated }]"
  >
    <span class="letters">LORA</span><span class="dot">.</span>
  </span>
</template>

<style scoped>
.lora-wordmark {
  font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 1;
  display: inline-block;
  cursor: default;
  user-select: none;
}

.size-sm { font-size: 16px; }
.size-md { font-size: 22px; }
.size-lg { font-size: 44px; }
.size-xl { font-size: 72px; }

.variant-dark     { color: #0A0A0A; }
.variant-light    { color: #FFFFFF; }
.variant-blue     { color: #0071E3; }
.variant-gradient {
  background: linear-gradient(135deg, #0071E3 0%, #06B6D4 50%, #8B5CF6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.letters {
  transition: letter-spacing 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  display: inline-block;
}

.dot {
  color: #0071E3;
  display: inline-block;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  animation: dot-color-cycle 8s ease-in-out infinite;
}

.variant-light .dot { color: #06B6D4; }
.variant-blue .dot  { color: #FFFFFF; }
.variant-gradient .dot {
  color: #8B5CF6;
  -webkit-text-fill-color: #8B5CF6;
}

@keyframes dot-color-cycle {
  0%, 100% { color: #0071E3; }
  33%      { color: #06B6D4; }
  66%      { color: #8B5CF6; }
}

.variant-light .dot { animation-name: dot-color-cycle-light; }
@keyframes dot-color-cycle-light {
  0%, 100% { color: #06B6D4; }
  33%      { color: #60A5FA; }
  66%      { color: #C4B5FD; }
}

/* Hover: kerning se abre levemente y punto salta */
.lora-wordmark:hover .letters {
  letter-spacing: -0.045em;
}
.lora-wordmark:hover .dot {
  transform: scale(1.3) translateY(-1px);
}

/* Modo animated: pulse suave continuo del punto (para login/hero) */
.animated .dot {
  animation: dot-color-cycle 8s ease-in-out infinite,
             dot-pulse 2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.2); }
}
</style>
