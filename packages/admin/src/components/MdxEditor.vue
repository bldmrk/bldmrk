<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
let ignoreNextUpdate = false

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            ignoreNextUpdate = true
            emit('update:modelValue', update.state.doc.toString())
          }
        }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
      ],
    }),
    parent: containerRef.value!,
  })
})

onUnmounted(() => view?.destroy())

watch(() => props.modelValue, (newVal) => {
  if (ignoreNextUpdate) { ignoreNextUpdate = false; return }
  if (!view || view.state.doc.toString() === newVal) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: newVal },
  })
})

function insertSyntax(before: string, after = before) {
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: to + before.length },
  })
  view.focus()
}
</script>

<template>
  <div class="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-1 px-2 py-1 border-b border-gray-200 bg-gray-50 flex-shrink-0">
      <button class="px-2 py-1 text-sm font-bold rounded hover:bg-gray-200" title="Bold" @click="insertSyntax('**')">B</button>
      <button class="px-2 py-1 text-sm italic rounded hover:bg-gray-200" title="Italic" @click="insertSyntax('_')">I</button>
      <button class="px-2 py-1 text-sm rounded hover:bg-gray-200" title="Heading" @click="insertSyntax('## ', '')">H</button>
      <button class="px-2 py-1 text-sm rounded hover:bg-gray-200 font-mono" title="Code" @click="insertSyntax('`')">` </button>
      <button class="px-2 py-1 text-sm rounded hover:bg-gray-200" title="Link" @click="insertSyntax('[', '](url)')">Link</button>
      <button class="px-2 py-1 text-sm rounded hover:bg-gray-200" title="Image" @click="insertSyntax('![alt](', ')')">Img</button>
    </div>
    <!-- Editor -->
    <div ref="containerRef" class="flex-1 overflow-hidden" />
  </div>
</template>
