<!-- Ruta: /src/components/SupportModeBanner.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Sprint 6: Banner naranja que se muestra arriba del panel cuando
     el super_admin está operando en una empresa que no es la suya.

     Funciones:
       - Indicador visual claro de "modo soporte"
       - Botón para volver al panel propio (admin.lorachat.net)
       - Muestra el nombre de la empresa que está viendo
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { useSupportMode } from '@/composables/useSupportMode'

const { isSupportMode, supportingOrgName, exitSupportMode } = useSupportMode()
</script>

<template>
  <div
    v-if="isSupportMode"
    class="support-banner"
    role="alert"
  >
    <div class="banner-content">
      <div class="banner-icon" aria-hidden="true">⚠️</div>
      <div class="banner-text">
        <span class="banner-title">Modo soporte activo</span>
        <span class="banner-subtitle">
          Estás viendo los datos de <strong>{{ supportingOrgName }}</strong> como super_admin.
          Las acciones que realices se registran en auditoría.
        </span>
      </div>
      <button
        class="banner-exit-btn"
        type="button"
        @click="exitSupportMode"
      >
        ← Volver a mi panel
      </button>
    </div>
  </div>
</template>

<style scoped>
.support-banner {
  background: linear-gradient(90deg, #F59E0B 0%, #D97706 100%);
  color: white;
  padding: 10px 20px;
  font-size: 13px;
  border-bottom: 1px solid #B45309;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 40;
}

.banner-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.banner-title {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 11px;
}

.banner-subtitle {
  font-size: 12px;
  opacity: 0.95;
  line-height: 1.4;
}

.banner-subtitle strong {
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.5);
  text-underline-offset: 2px;
}

.banner-exit-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.banner-exit-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
}

.banner-exit-btn:active {
  transform: translateY(0);
}

@media (max-width: 640px) {
  .banner-text {
    font-size: 11px;
  }
  .banner-subtitle {
    display: none;
  }
  .banner-exit-btn {
    font-size: 11px;
    padding: 4px 8px;
  }
}
</style>
