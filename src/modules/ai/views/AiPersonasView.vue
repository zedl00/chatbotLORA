<!-- Ruta: /src/modules/ai/views/AiPersonasView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useActiveOrganizationId } from '@/composables/useActiveOrganizationId'
import { SupabaseAiRepo } from '@/repository/supabase/ai.repo'
import type { BotPersona, CreateBotPersonaInput } from '@/types/ai.types'
import {
  CLAUDE_MODELS, TONE_OPTIONS, LANGUAGE_OPTIONS
} from '@/types/ai.types'

const repo = new SupabaseAiRepo()
const activeOrgId = useActiveOrganizationId()

const personas = ref<BotPersona[]>([])
const loading = ref(false)
const editing = ref<BotPersona | null>(null)
const showForm = ref(false)

const form = ref<CreateBotPersonaInput>(emptyForm())

function emptyForm(): CreateBotPersonaInput {
  return {
    name: '',
    slug: '',
    description: '',
    identity: 'Eres un asistente virtual de [EMPRESA]. Tu personalidad es cálida y profesional.',
    objective: 'Ayudar a los clientes con sus consultas de forma rápida y precisa.',
    tone: 'friendly',
    language: 'es',
    restrictions: 'No inventes información. Si no sabes algo, pídele al cliente que hable con un agente humano.',
    fallbackMessage: 'Déjame verificar eso y te respondo en unos minutos.',
    handoffKeyword: '[HANDOFF]',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 1000,
    maxHistoryMsgs: 20,
    useKnowledgeBase: true,
    kbTopK: 5,
    kbThreshold: 0.75,
    enableClassification: true,
    enableSuggestions: true,
    isDefault: false
  }
}

async function load() {
  if (!activeOrgId.value) return
  loading.value = true
  try {
    personas.value = await repo.listPersonas(activeOrgId.value)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editing.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(p: BotPersona) {
  editing.value = p
  form.value = {
    name: p.name, slug: p.slug,
    description: p.description ?? '',
    identity: p.identity, objective: p.objective ?? '',
    tone: p.tone, language: p.language,
    restrictions: p.restrictions ?? '',
    fallbackMessage: p.fallbackMessage ?? '',
    handoffKeyword: p.handoffKeyword,
    model: p.model, temperature: p.temperature,
    maxTokens: p.maxTokens, maxHistoryMsgs: p.maxHistoryMsgs,
    useKnowledgeBase: p.useKnowledgeBase,
    kbTopK: p.kbTopK, kbThreshold: p.kbThreshold,
    enableClassification: p.enableClassification,
    enableSuggestions: p.enableSuggestions,
    isDefault: p.isDefault
  }
  showForm.value = true
}

async function handleSave() {
  if (!activeOrgId.value) return
  try {
    if (editing.value) {
      await repo.updatePersona(editing.value.id, form.value)
    } else {
      if (!form.value.slug) {
        form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      }
      await repo.createPersona(activeOrgId.value, form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al guardar')
  }
}

async function makeDefault(p: BotPersona) {
  if (!activeOrgId.value) return
  await repo.setDefaultPersona(p.id, activeOrgId.value)
  await load()
}

async function toggleActive(p: BotPersona) {
  await repo.updatePersona(p.id, { active: !p.active })
  await load()
}

async function handleDelete(p: BotPersona) {
  if (p.isDefault) {
    alert('No puedes eliminar la persona por defecto. Marca otra como default primero.')
    return
  }
  if (!confirm(`¿Eliminar "${p.name}"? Las conversaciones que la usen quedarán sin persona asignada.`)) return
  await repo.deletePersona(p.id)
  await load()
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-bold">Personalidades del Bot</h2>
        <p class="text-slate-500 mt-1">
          Configura las personalidades que el bot puede asumir (Soporte, Ventas, General, etc.)
        </p>
      </div>
      <button v-can="'ai.configure'" class="btn-primary" @click="startCreate">
        ➕ Nueva personalidad
      </button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-slate-400">Cargando...</div>

    <div v-else-if="personas.length === 0" class="card p-12 text-center text-slate-500">
      <p class="text-lg mb-2">🤖 Aún no tienes personalidades configuradas</p>
      <p class="text-sm">Crea una para que el bot sepa cómo responder.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="p in personas"
        :key="p.id"
        class="card p-5 flex flex-col"
        :class="!p.active && 'opacity-60'"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-lg">{{ p.name }}</h3>
              <span
                v-if="p.isDefault"
                class="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full"
              >Default</span>
              <span
                v-if="!p.active"
                class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
              >Inactivo</span>
            </div>
            <p class="text-sm text-slate-500 mt-1">{{ p.description ?? p.identity.slice(0, 100) + '...' }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-1 mb-3">
          <span class="text-xs bg-slate-100 px-2 py-0.5 rounded">{{ p.tone }}</span>
          <span class="text-xs bg-slate-100 px-2 py-0.5 rounded">{{ p.language }}</span>
          <span class="text-xs bg-slate-100 px-2 py-0.5 rounded">
            {{ p.model.includes('haiku') ? 'Haiku' : p.model.includes('opus') ? 'Opus' : 'Sonnet' }}
          </span>
          <span v-if="p.useKnowledgeBase" class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
            RAG ✓
          </span>
        </div>

        <div class="mt-auto flex gap-2 pt-3 border-t border-surface-border">
          <button v-can="'ai.configure'" class="text-xs text-brand-600 hover:underline" @click="startEdit(p)">
            Editar
          </button>
          <button
            v-if="!p.isDefault"
            v-can="'ai.configure'"
            class="text-xs text-brand-600 hover:underline"
            @click="makeDefault(p)"
          >Hacer default</button>
          <button v-can="'ai.configure'" class="text-xs text-slate-600 hover:underline" @click="toggleActive(p)">
            {{ p.active ? 'Desactivar' : 'Activar' }}
          </button>
          <button v-can="'ai.configure'" class="text-xs text-red-600 hover:underline ml-auto" @click="handleDelete(p)">
            Eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal formulario -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
      @click.self="showForm = false"
    >
      <div class="bg-white rounded-2xl shadow-pop max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div class="sticky top-0 bg-white px-6 py-4 border-b border-surface-border flex justify-between items-center">
          <h3 class="text-lg font-bold">
            {{ editing ? `Editar: ${editing.name}` : 'Nueva personalidad' }}
          </h3>
          <button class="text-slate-400 hover:text-slate-600 text-xl" @click="showForm = false">✕</button>
        </div>

        <form class="p-6 space-y-6" @submit.prevent="handleSave">
          <!-- Identidad básica -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">📛 Identidad básica</h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input v-model="form.name" required class="input" placeholder="Asistente de Soporte" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">
                  Slug <span class="text-slate-400 font-normal">(id único, sin espacios)</span>
                </label>
                <input
                  v-model="form.slug"
                  class="input font-mono"
                  placeholder="support"
                  :disabled="!!editing"
                />
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-sm font-medium mb-1">Descripción</label>
              <input v-model="form.description" class="input" placeholder="Atención técnica y postventa" />
            </div>
          </section>

          <!-- System prompt -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">🧠 System prompt</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">Identidad del bot</label>
                <textarea
                  v-model="form.identity"
                  required
                  class="input font-mono text-sm"
                  rows="3"
                />
                <p class="text-xs text-slate-500 mt-1">Quién es el bot, cómo habla, a qué empresa representa</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Objetivo</label>
                <textarea
                  v-model="form.objective"
                  class="input font-mono text-sm"
                  rows="2"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Restricciones</label>
                <textarea
                  v-model="form.restrictions"
                  class="input font-mono text-sm"
                  rows="2"
                  placeholder="No des consejos médicos/legales/financieros. No inventes precios."
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium mb-1">Mensaje de fallback</label>
                  <input v-model="form.fallbackMessage" class="input text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Keyword de handoff
                  </label>
                  <input v-model="form.handoffKeyword" class="input font-mono text-sm" placeholder="[HANDOFF]" />
                </div>
              </div>
            </div>
          </section>

          <!-- Estilo -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">🎨 Estilo</h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Tono</label>
                <select v-model="form.tone" class="input">
                  <option v-for="t in TONE_OPTIONS" :key="t.value" :value="t.value">
                    {{ t.label }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Idioma</label>
                <select v-model="form.language" class="input">
                  <option v-for="l in LANGUAGE_OPTIONS" :key="l.value" :value="l.value">
                    {{ l.label }}
                  </option>
                </select>
              </div>
            </div>
          </section>

          <!-- Modelo -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">⚙️ Modelo IA</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">Modelo Claude</label>
                <select v-model="form.model" class="input">
                  <option v-for="m in CLAUDE_MODELS" :key="m.value" :value="m.value">
                    {{ m.label }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Temperatura ({{ form.temperature }})
                  </label>
                  <input
                    v-model.number="form.temperature"
                    type="range" min="0" max="1" step="0.1"
                    class="w-full"
                  />
                  <p class="text-xs text-slate-500">0 = determinista, 1 = creativo</p>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Max tokens respuesta</label>
                  <input v-model.number="form.maxTokens" type="number" min="50" max="4000" class="input" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Historial (msgs)</label>
                  <input v-model.number="form.maxHistoryMsgs" type="number" min="5" max="50" class="input" />
                </div>
              </div>
            </div>
          </section>

          <!-- RAG -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">📚 Base de conocimiento (RAG)</h4>
            <label class="flex items-center gap-2 mb-3">
              <input v-model="form.useKnowledgeBase" type="checkbox" />
              <span class="text-sm">Usar base de conocimiento para responder</span>
            </label>
            <div v-if="form.useKnowledgeBase" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Top K (chunks)</label>
                <input v-model.number="form.kbTopK" type="number" min="1" max="20" class="input" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Umbral similitud ({{ form.kbThreshold }})</label>
                <input
                  v-model.number="form.kbThreshold"
                  type="range" min="0.5" max="0.95" step="0.05"
                  class="w-full"
                />
              </div>
            </div>
          </section>

          <!-- Features opcionales -->
          <section>
            <h4 class="font-semibold mb-3 text-slate-700">✨ Features</h4>
            <label class="flex items-center gap-2">
              <input v-model="form.enableClassification" type="checkbox" />
              <span class="text-sm">Clasificar automáticamente cada mensaje (intención, sentimiento, urgencia)</span>
            </label>
            <label class="flex items-center gap-2 mt-2">
              <input v-model="form.enableSuggestions" type="checkbox" />
              <span class="text-sm">Permitir sugerencias de respuesta a agentes humanos</span>
            </label>
            <label class="flex items-center gap-2 mt-2">
              <input v-model="form.isDefault" type="checkbox" />
              <span class="text-sm">Usar como personalidad por defecto de la organización</span>
            </label>
          </section>

          <!-- Footer -->
          <div class="flex justify-end gap-2 pt-4 border-t border-surface-border sticky bottom-0 bg-white">
            <button type="button" class="btn-secondary" @click="showForm = false">Cancelar</button>
            <button type="submit" class="btn-primary">
              {{ editing ? 'Guardar cambios' : 'Crear personalidad' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
