<!-- Ruta: /src/modules/contacts/components/TagInput.vue -->
<!-- ═══════════════════════════════════════════════════════════════
     Input de tags con autocompletado + "Enter para agregar".
     Usado en ContactFormModal y ContactDetailView.
     ═══════════════════════════════════════════════════════════════ -->
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue: string[]
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  placeholder: 'Agregar tag (Enter)',
  maxTags: 20
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const input = ref('')
const showSuggestions = ref(false)

const filteredSuggestions = computed(() => {
  const q = input.value.trim().toLowerCase()
  if (!q) return []
  return props.suggestions
    .filter((s) => !props.modelValue.includes(s))
    .filter((s) => s.toLowerCase().includes(q))
    .slice(0, 5)
})

function addTag(value: string) {
  const tag = value.trim().toLowerCase()
  if (!tag) return
  if (props.modelValue.includes(tag)) {
    input.value = ''
    return
  }
  if (props.modelValue.length >= props.maxTags) return

  emit('update:modelValue', [...props.modelValue, tag])
  input.value = ''
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter((t) => t !== tag))
}

function handleEnter() {
  if (input.value.trim()) {
    addTag(input.value)
  }
}

function handleBackspace() {
  if (!input.value && props.modelValue.length > 0) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function selectSuggestion(s: string) {
  addTag(s)
  showSuggestions.value = false
}

// 🆕 Fix: setTimeout fuera del template (TypeScript estricto no lo permite inline)
function handleBlur() {
  // Delay para permitir click en sugerencia antes de ocultar
  window.setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

function handleFocus() {
  showSuggestions.value = true
}
</script>

<template>
  <div class="relative">
    <div class="input flex flex-wrap items-center gap-1.5 min-h-[2.5rem] py-1.5">
      <span
        v-for="tag in modelValue"
        :key="tag"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-medium"
      >
        {{ tag }}
        <button
          type="button"
          class="hover:text-brand-900"
          @click="removeTag(tag)"
        >
          ×
        </button>
      </span>

      <input
        v-model="input"
        type="text"
        class="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        @keydown.enter.prevent="handleEnter"
        @keydown.backspace="handleBackspace"
        @focus="handleFocus"
        @blur="handleBlur"
      />
    </div>

    <!-- Autocompletado -->
    <div
      v-if="showSuggestions && filteredSuggestions.length > 0"
      class="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-border rounded-xl shadow-card z-10 overflow-hidden"
    >
      <button
        v-for="s in filteredSuggestions"
        :key="s"
        type="button"
        class="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted"
        @mousedown.prevent="selectSuggestion(s)"
      >
        {{ s }}
      </button>
    </div>
  </div>
</template>
