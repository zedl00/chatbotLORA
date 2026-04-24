<!-- Ruta: /src/modules/channels/components/ChannelCard.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ChannelMetrics } from '@/types/channel.types'
import { getChannelMetadata, timeSince } from '@/types/channel.types'
import { useUiStore } from '@/stores/ui.store'
import ChannelActionsMenu from './ChannelActionsMenu.vue'

interface Props {
  channel: ChannelMetrics
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'duplicate', id: string): void
  (e: 'rename', channel: ChannelMetrics): void
  (e: 'toggle', id: string, active: boolean): void
  (e: 'delete', channel: ChannelMetrics): void
}>()

const router = useRouter()
const ui = useUiStore()

const meta = getChannelMetadata(props.channel.type)

const copyMenuOpen = ref(false)
const copyMenuRef = ref<HTMLElement | null>(null)

function goToConfig() {
  if (props.channel.type !== 'web_widget') {
    ui.showToast('info', `Configuración para ${meta.label} estará disponible pronto`)
    return
  }
  router.push(`/admin/channels/widget/${props.channel.channelId}`)
}

async function copyToClipboard(text: string, label: string) {
  copyMenuOpen.value = false
  try {
    await navigator.clipboard.writeText(text)
    ui.showToast('success', `${label} copiado`)
  } catch {
    ui.showToast('error', 'No se pudo copiar. Ve a Configuración → Instalación')
  }
}

function copyHtmlSnippet() {
  const snippet = `<!-- LORA Chat Widget -->
<script>
  window.LoraChat = { channelId: '${props.channel.channelId}' };
<\/script>
<script async src="https://lora.jabenter.com/widget.js"><\/script>`
  copyToClipboard(snippet, 'Código HTML')
}

function copyChannelId() {
  copyToClipboard(props.channel.channelId, 'Channel ID')
}

function copyWidgetUrl() {
  copyToClipboard('https://lora.jabenter.com/widget.js', 'URL del widget')
}

function handleClickOutside(e: MouseEvent) {
  if (copyMenuRef.value && !copyMenuRef.value.contains(e.target as Node)) {
    copyMenuOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div
    class="bg-white border border-surface-border rounded-xl p-5 hover:shadow-md transition-all"
    :class="!channel.active && 'opacity-70'"
  >
    <!-- Header row -->
    <div class="flex items-start gap-3">
      <div
        class="w-12 h-12 rounded-xl grid place-items-center text-2xl flex-shrink-0"
        :style="{ backgroundColor: `${meta.color}15`, color: meta.color }"
      >
        {{ meta.icon }}
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-semibold text-slate-800 truncate">{{ channel.name }}</h3>
          <span
            class="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide flex items-center gap-1"
            :class="channel.active
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="channel.active ? 'bg-emerald-500' : 'bg-slate-400'"
            />
            {{ channel.active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
        <div class="text-xs text-slate-500 mt-0.5">
          {{ meta.label }}
          <span class="text-slate-300 mx-1">·</span>
          ID: <code class="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{{ channel.channelId.slice(0, 8) }}...</code>
        </div>
      </div>

      <ChannelActionsMenu
        :channel="channel"
        @duplicate="emit('duplicate', channel.channelId)"
        @rename="emit('rename', channel)"
        @toggle="emit('toggle', channel.channelId, !channel.active)"
        @delete="emit('delete', channel)"
      />
    </div>

    <!-- Métricas -->
    <div class="grid grid-cols-3 gap-3 mt-4 mb-4">
      <div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Conversaciones</div>
        <div class="text-lg font-semibold text-slate-800">{{ channel.totalConversations }}</div>
        <div v-if="channel.conversations30d > 0" class="text-[10px] text-slate-500">
          +{{ channel.conversations30d }} últimos 30d
        </div>
      </div>
      <div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">CSAT (30d)</div>
        <div v-if="channel.avgCsat30d !== null" class="text-lg font-semibold text-slate-800">
          {{ channel.avgCsat30d.toFixed(1) }} <span class="text-amber-500 text-sm">★</span>
        </div>
        <div v-else class="text-sm text-slate-400 mt-1">—</div>
        <div v-if="channel.csatCount30d > 0" class="text-[10px] text-slate-500">
          {{ channel.csatCount30d }} ratings
        </div>
      </div>
      <div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Actividad</div>
        <div class="text-sm font-medium text-slate-700 mt-0.5">
          {{ timeSince(channel.lastActivityAt) }}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 pt-3 border-t border-surface-border">
      <button
        class="flex-1 btn-primary !py-1.5 !text-xs flex items-center justify-center gap-1.5"
        @click="goToConfig"
      >
        ⚙️ Configurar
      </button>

      <!-- Dropdown copiar (solo para web_widget) -->
      <div v-if="channel.type === 'web_widget'" ref="copyMenuRef" class="relative">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          @click.stop="copyMenuOpen = !copyMenuOpen"
        >
          📋 Copiar
          <span class="text-[10px] text-slate-400">▾</span>
        </button>

        <div
          v-if="copyMenuOpen"
          class="absolute top-full right-0 mt-1 w-56 bg-white border border-surface-border rounded-xl shadow-card z-20 py-1"
        >
          <button
            class="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 flex flex-col gap-0.5"
            @click="copyHtmlSnippet"
          >
            <span class="font-medium text-slate-800">📋 Código HTML completo</span>
            <span class="text-[10px] text-slate-500">Para pegar en tu sitio web</span>
          </button>
          <button
            class="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 flex flex-col gap-0.5"
            @click="copyChannelId"
          >
            <span class="font-medium text-slate-800">🔑 Solo Channel ID</span>
            <span class="text-[10px] text-slate-500">Para usar en código React/Vue</span>
          </button>
          <button
            class="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 flex flex-col gap-0.5"
            @click="copyWidgetUrl"
          >
            <span class="font-medium text-slate-800">🔗 URL del widget.js</span>
            <span class="text-[10px] text-slate-500">La ruta del script</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
