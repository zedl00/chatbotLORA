<!-- Ruta: /src/modules/channels/views/ChannelsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/services/supabase.client'
import WidgetConfigEditor from '../components/WidgetConfigEditor.vue'
import WidgetInstallSnippet from '../components/WidgetInstallSnippet.vue'

const auth = useAuthStore()

interface Channel {
  id: string
  type: string
  name: string
  active: boolean
  created_at: string
  widget_config_id?: string
}

const channels = ref<Channel[]>([])
const loading = ref(false)
const editingId = ref<string | null>(null)
const showInstall = ref<string | null>(null)

async function load() {
  if (!auth.organizationId) return
  loading.value = true
  try {
    const { data } = await supabase
      .from('channels')
      .select('*, widget_configs(id)')
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })
    channels.value = (data ?? []).map((c: any) => ({
      ...c,
      widget_config_id: c.widget_configs?.[0]?.id
    }))
  } finally {
    loading.value = false
  }
}

async function toggleActive(ch: Channel) {
  await supabase.from('channels').update({ active: !ch.active }).eq('id', ch.id)
  await load()
}

const channelIcons: Record<string, string> = {
  web_widget: '🌐',
  whatsapp: '📱',
  telegram: '✈️',
  instagram: '📷',
  messenger: '💬',
  email: '✉️'
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-bold">Canales</h2>
        <p class="text-slate-500 mt-1">Gestiona los canales por donde llegan las conversaciones.</p>
      </div>
    </div>

    <div v-if="loading" class="card p-8 text-center text-slate-400">Cargando...</div>

    <div v-else-if="channels.length === 0" class="card p-12 text-center text-slate-500">
      <p>No hay canales configurados todavía.</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="ch in channels" :key="ch.id" class="card p-5">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="text-3xl">{{ channelIcons[ch.type] ?? '📡' }}</div>
            <div>
              <div class="font-semibold">{{ ch.name }}</div>
              <div class="text-xs text-slate-500">{{ ch.type }}</div>
              <div class="mt-1">
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="ch.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                >
                  {{ ch.active ? '● Activo' : '○ Inactivo' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              v-if="ch.type === 'web_widget'"
              class="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100"
              @click="showInstall = showInstall === ch.id ? null : ch.id"
            >
              {{ showInstall === ch.id ? '▲ Ocultar' : '📋 Código de instalación' }}
            </button>
            <button
              v-if="ch.type === 'web_widget'"
              class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              @click="editingId = editingId === ch.id ? null : ch.id"
            >
              {{ editingId === ch.id ? '▲ Cerrar' : '🎨 Personalizar' }}
            </button>
            <button
              v-can="'channels.update'"
              class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              @click="toggleActive(ch)"
            >
              {{ ch.active ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </div>

        <!-- Install snippet -->
        <WidgetInstallSnippet
          v-if="showInstall === ch.id && ch.type === 'web_widget'"
          :channel-id="ch.id"
        />

        <!-- Editor de personalización -->
        <WidgetConfigEditor
          v-if="editingId === ch.id && ch.type === 'web_widget'"
          :channel-id="ch.id"
          @saved="load"
        />
      </div>
    </div>
  </div>
</template>
