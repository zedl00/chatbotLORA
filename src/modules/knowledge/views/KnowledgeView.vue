<!-- Ruta: /src/modules/knowledge/views/KnowledgeView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { SupabaseAiRepo } from '@/repository/supabase/ai.repo'
import { embedKnowledgeDoc } from '@/services/claude.service'
import type { KnowledgeDoc } from '@/types/ai.types'
import { formatDateShort } from '@/utils/format'

const auth = useAuthStore()
const repo = new SupabaseAiRepo()

const docs = ref<KnowledgeDoc[]>([])
const loading = ref(false)
const editing = ref<KnowledgeDoc | null>(null)
const showForm = ref(false)
const embedding = ref<string | null>(null)

const form = ref({
  title: '',
  content: '',
  tags: [] as string[]
})

async function load() {
  if (!auth.organizationId) return
  loading.value = true
  try {
    docs.value = await repo.listKnowledgeDocs(auth.organizationId)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editing.value = null
  form.value = { title: '', content: '', tags: [] }
  showForm.value = true
}

function startEdit(doc: KnowledgeDoc) {
  editing.value = doc
  form.value = { title: doc.title, content: doc.content, tags: [...doc.tags] }
  showForm.value = true
}

async function handleSave() {
  if (!auth.organizationId) return
  try {
    let docId: string
    if (editing.value) {
      const updated = await repo.updateKnowledgeDoc(editing.value.id, form.value)
      docId = updated.id
    } else {
      const created = await repo.createKnowledgeDoc({
        organizationId: auth.organizationId,
        ...form.value
      })
      docId = created.id
    }
    showForm.value = false
    await load()

    // Procesar embeddings automáticamente
    await processEmbeddings(docId)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al guardar')
  }
}

async function processEmbeddings(docId: string) {
  embedding.value = docId
  try {
    const result = await embedKnowledgeDoc(docId)
    alert(`✅ Documento indexado: ${result.chunks} chunks procesados.`)
    await load()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg.includes('VOYAGE_API_KEY no configurada')) {
      alert('⚠️ RAG no disponible: falta configurar VOYAGE_API_KEY en Supabase Secrets.\n\nEl documento se guardó pero el bot no podrá usarlo todavía.\n\nObtén una key gratis en https://www.voyageai.com')
    } else {
      alert('Error al indexar: ' + msg)
    }
  } finally {
    embedding.value = null
  }
}

async function handleDelete(doc: KnowledgeDoc) {
  if (!confirm(`¿Eliminar "${doc.title}"?`)) return
  await repo.deleteKnowledgeDoc(doc.id)
  await load()
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-bold">Base de Conocimiento</h2>
        <p class="text-slate-500 mt-1">
          Documentos que el bot consulta para responder (RAG).
        </p>
      </div>
      <button v-can="'knowledge.create'" class="btn-primary" @click="startCreate">
        ➕ Nuevo documento
      </button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-slate-400">Cargando...</div>

    <div v-else-if="docs.length === 0" class="card p-12 text-center text-slate-500">
      <p class="text-lg mb-2">📚 No hay documentos aún</p>
      <p class="text-sm">Agrega documentos (FAQs, políticas, catálogos) para que el bot responda con información precisa.</p>
    </div>

    <div v-else class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface-muted text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Título</th>
            <th class="px-4 py-3 font-medium">Etiquetas</th>
            <th class="px-4 py-3 font-medium">Chunks</th>
            <th class="px-4 py-3 font-medium">Actualizado</th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border">
          <tr v-for="doc in docs" :key="doc.id" class="hover:bg-surface-muted/50">
            <td class="px-4 py-3">
              <div class="font-medium">{{ doc.title }}</div>
              <div class="text-xs text-slate-500 truncate max-w-md">
                {{ doc.content.slice(0, 100) }}{{ doc.content.length > 100 ? '...' : '' }}
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span v-for="t in doc.tags" :key="t" class="text-xs bg-slate-100 px-2 py-0.5 rounded">
                  {{ t }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="doc.chunkCount && doc.chunkCount > 0" class="text-emerald-700 text-xs">
                ✓ {{ doc.chunkCount }} chunks
              </span>
              <span v-else class="text-amber-600 text-xs">⚠ Sin indexar</span>
            </td>
            <td class="px-4 py-3 text-slate-500 text-xs">{{ formatDateShort(doc.updatedAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-can="'knowledge.update'"
                class="text-brand-600 hover:underline text-xs mr-2"
                :disabled="embedding === doc.id"
                @click="processEmbeddings(doc.id)"
              >
                {{ embedding === doc.id ? 'Indexando...' : '🔄 Indexar' }}
              </button>
              <button v-can="'knowledge.update'" class="text-brand-600 hover:underline text-xs mr-2" @click="startEdit(doc)">
                Editar
              </button>
              <button v-can="'knowledge.delete'" class="text-red-600 hover:underline text-xs" @click="handleDelete(doc)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal formulario -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
      @click.self="showForm = false"
    >
      <div class="bg-white rounded-2xl shadow-pop max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-auto">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold">{{ editing ? 'Editar documento' : 'Nuevo documento' }}</h3>
          <button class="text-slate-400 text-xl" @click="showForm = false">✕</button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSave">
          <div>
            <label class="block text-sm font-medium mb-1">Título</label>
            <input v-model="form.title" required class="input" placeholder="Política de devoluciones" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Contenido</label>
            <textarea
              v-model="form.content"
              required
              rows="12"
              class="input font-mono text-sm"
              placeholder="Escribe o pega el texto que quieres que el bot consulte..."
            />
            <p class="text-xs text-slate-500 mt-1">
              Al guardar se dividirá automáticamente en chunks y se generarán embeddings.
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">
              Etiquetas <span class="text-slate-400 font-normal">(separadas por coma)</span>
            </label>
            <input
              :value="form.tags.join(', ')"
              class="input"
              placeholder="devoluciones, politicas, postventa"
              @input="form.tags = ($event.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean)"
            />
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" @click="showForm = false">Cancelar</button>
            <button type="submit" class="btn-primary">
              {{ editing ? 'Guardar' : 'Crear e indexar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
