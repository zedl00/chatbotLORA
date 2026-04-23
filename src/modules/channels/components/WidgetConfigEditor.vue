<!-- Ruta: /src/modules/channels/components/WidgetConfigEditor.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     MODIFICADO en Rebranding público (Sprint 7.5):
       - Label "Powered by ChatBot IA" → "Powered by LORA"
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '@/services/supabase.client'

const props = defineProps<{ channelId: string }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const config = ref<any>(null)
const loading = ref(false)
const saving = ref(false)

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('widget_configs')
    .select('*')
    .eq('channel_id', props.channelId)
    .maybeSingle()
  config.value = data
  loading.value = false
}

async function save() {
  if (!config.value) return
  saving.value = true
  try {
    const patch = {
      brand_name: config.value.brand_name,
      logo_url: config.value.logo_url || null,
      primary_color: config.value.primary_color,
      accent_color: config.value.accent_color || config.value.primary_color,
      position: config.value.position,
      launcher_icon: config.value.launcher_icon,
      welcome_title: config.value.welcome_title,
      welcome_subtitle: config.value.welcome_subtitle,
      input_placeholder: config.value.input_placeholder,
      offline_message: config.value.offline_message,
      require_name: config.value.require_name,
      require_email: config.value.require_email,
      require_phone: config.value.require_phone,
      pre_chat_message: config.value.pre_chat_message,
      auto_open: config.value.auto_open,
      auto_open_delay_ms: config.value.auto_open_delay_ms,
      show_powered_by: config.value.show_powered_by
    }
    await supabase.from('widget_configs').update(patch).eq('id', config.value.id)
    emit('saved')
    alert('Configuración guardada ✓')
  } catch (e) {
    alert('Error: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mt-4 pt-4 border-t border-surface-border">
    <div v-if="loading" class="text-center text-slate-400 py-4 text-sm">Cargando...</div>
    <div v-else-if="!config" class="text-center text-red-600 py-4 text-sm">No hay config para este canal</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Columna izquierda: identidad visual -->
      <div class="space-y-3">
        <h4 class="font-semibold text-slate-700 text-sm">🎨 Identidad visual</h4>

        <div>
          <label class="block text-xs font-medium mb-1">Nombre de la marca</label>
          <input v-model="config.brand_name" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <div>
          <label class="block text-xs font-medium mb-1">URL del logo (opcional)</label>
          <input v-model="config.logo_url" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" placeholder="https://..." />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium mb-1">Color primario</label>
            <div class="flex gap-1">
              <input type="color" v-model="config.primary_color" class="w-10 h-8 rounded border cursor-pointer" />
              <input v-model="config.primary_color" class="flex-1 text-sm border border-surface-border rounded px-2 py-1.5" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1">Icono del launcher</label>
            <input v-model="config.launcher_icon" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" placeholder="💬" maxlength="4" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium mb-1">Posición</label>
          <select v-model="config.position" class="w-full text-sm border border-surface-border rounded px-2 py-1.5">
            <option value="bottom-right">Abajo derecha</option>
            <option value="bottom-left">Abajo izquierda</option>
          </select>
        </div>

        <div class="space-y-1 pt-2">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="config.show_powered_by" />
            Mostrar "Powered by LORA"
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="config.auto_open" />
            Abrir automáticamente
          </label>
          <div v-if="config.auto_open">
            <label class="block text-xs font-medium mb-1 mt-1">Retraso (ms)</label>
            <input type="number" v-model.number="config.auto_open_delay_ms" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
          </div>
        </div>
      </div>

      <!-- Columna derecha: copy + pre-chat -->
      <div class="space-y-3">
        <h4 class="font-semibold text-slate-700 text-sm">💬 Copy</h4>

        <div>
          <label class="block text-xs font-medium mb-1">Título de bienvenida</label>
          <input v-model="config.welcome_title" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <div>
          <label class="block text-xs font-medium mb-1">Subtítulo</label>
          <input v-model="config.welcome_subtitle" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <div>
          <label class="block text-xs font-medium mb-1">Placeholder del input</label>
          <input v-model="config.input_placeholder" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <div>
          <label class="block text-xs font-medium mb-1">Mensaje fuera de línea</label>
          <input v-model="config.offline_message" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <h4 class="font-semibold text-slate-700 text-sm pt-2">📋 Pre-chat (datos del visitante)</h4>

        <div>
          <label class="block text-xs font-medium mb-1">Mensaje del pre-chat</label>
          <input v-model="config.pre_chat_message" class="w-full text-sm border border-surface-border rounded px-2 py-1.5" />
        </div>

        <div class="space-y-1">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="config.require_name" />
            Pedir nombre
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="config.require_email" />
            Pedir email
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="config.require_phone" />
            Pedir teléfono
          </label>
        </div>
      </div>
    </div>

    <div v-if="config" class="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-border">
      <button
        class="px-4 py-1.5 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Guardando...' : '💾 Guardar cambios' }}
      </button>
    </div>
  </div>
</template>
