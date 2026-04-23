<!-- Ruta: /src/modules/super-admin/components/WidgetPreview.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Preview visual en vivo del widget durante el wizard.
     Muestra cómo se verá el chat con los colores/mensaje elegidos.
     No es funcional, solo visual.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  primaryColor: string
  brandName: string
  welcomeMessage: string
}
const props = defineProps<Props>()

// Derivar un color dark a partir del primary (para el gradient del header)
function darken(hex: string, factor = 0.2): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor)))
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor)))
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const headerGradient = computed(() => {
  return `linear-gradient(135deg, ${props.primaryColor} 0%, ${darken(props.primaryColor)} 100%)`
})

const brandInitial = computed(() => {
  return (props.brandName || 'L').trim().charAt(0).toUpperCase()
})
</script>

<template>
  <div class="widget-preview-frame">
    <!-- Panel simulado -->
    <div class="panel">
      <!-- Header con gradient -->
      <div class="header" :style="{ background: headerGradient }">
        <div class="logo">{{ brandInitial }}</div>
        <div class="header-info">
          <div class="title">{{ brandName || 'Empresa' }}</div>
          <div class="subtitle">
            <span class="dot"></span>
            En línea
          </div>
        </div>
      </div>

      <!-- Body con welcome + mensaje de ejemplo -->
      <div class="body">
        <div class="welcome">
          <div class="welcome-icon" :style="{ background: headerGradient }">💬</div>
          <div class="welcome-title">¡Hola!</div>
          <div class="welcome-sub">¿En qué te podemos ayudar?</div>
        </div>

        <div class="msg msg-bot">
          <div class="bubble">{{ welcomeMessage || '¡Hola! ¿En qué te podemos ayudar?' }}</div>
        </div>

        <div class="msg msg-contact">
          <div class="bubble" :style="{ background: headerGradient }">
            ¡Hola! Quisiera saber sobre sus servicios.
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <div class="input">Escribe tu mensaje...</div>
        <button class="send-btn" :style="{ background: headerGradient }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      <div class="powered">LORA</div>
    </div>
  </div>
</template>

<style scoped>
.widget-preview-frame {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: repeating-linear-gradient(
    45deg,
    #f8fafc,
    #f8fafc 10px,
    #f1f5f9 10px,
    #f1f5f9 20px
  );
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.panel {
  width: 260px;
  background: white;
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.1),
    0 2px 6px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Header */
.header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
}
.logo {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: grid; place-items: center;
  font-weight: 700;
  font-size: 13px;
}
.header-info {
  flex: 1;
  min-width: 0;
}
.title {
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
}
.subtitle {
  font-size: 10px;
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 6px #4ade80;
}

/* Body */
.body {
  padding: 12px 10px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 150px;
  max-height: 220px;
  overflow-y: auto;
}
.welcome {
  text-align: center;
  padding: 6px 4px 12px;
}
.welcome-icon {
  width: 32px; height: 32px;
  margin: 0 auto 6px;
  border-radius: 50%;
  display: grid; place-items: center;
  color: white;
  font-size: 14px;
}
.welcome-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.welcome-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.msg {
  max-width: 80%;
}
.msg-bot { align-self: flex-start; }
.msg-contact { align-self: flex-end; }
.bubble {
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.4;
}
.msg-bot .bubble {
  background: white;
  color: #0f172a;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 3px;
}
.msg-contact .bubble {
  color: white;
  border-bottom-right-radius: 3px;
}

/* Input */
.input-area {
  padding: 8px 10px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  gap: 6px;
  align-items: center;
  background: white;
}
.input {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 10px;
  color: #94a3b8;
}
.send-btn {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  color: white;
  display: grid; place-items: center;
  cursor: default;
}

.powered {
  text-align: center;
  font-size: 9px;
  color: #94a3b8;
  padding: 4px;
  font-weight: 600;
  background: white;
}
</style>
