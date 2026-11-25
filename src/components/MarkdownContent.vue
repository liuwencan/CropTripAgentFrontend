<script setup lang="ts">
import { computed } from 'vue'
import MarkdownRender, { enableKatex, enableMermaid } from 'markstream-vue'
import 'katex/dist/katex.min.css'
import 'markstream-vue/index.css'

const props = withDefaults(defineProps<{ source: string; isStreaming?: boolean }>(), { isStreaming: false })

function normalizeCompactListMarkers(source: string) {
  const parts = source.split(/(\r?\n)/)
  let fence: { marker: string; length: number } | null = null

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? ''
    const fenceStart = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      const fenceEnd = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
      if (fenceEnd && fenceEnd[1]![0] === fence.marker && fenceEnd[1]!.length >= fence.length) fence = null
      continue
    }
    if (fenceStart) {
      fence = { marker: fenceStart[1]![0]!, length: fenceStart[1]!.length }
      continue
    }
    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(line)) continue

    parts[index] = line
      .replace(/^([ \t]{0,3})([-+*])(?=\S)/, '$1$2 ')
      .replace(/^([ \t]{0,3})(\d{1,9}[.)])(?=[^\s\d])/, '$1$2 ')
  }

  return parts.join('')
}

enableKatex()
enableMermaid()

const markdown = computed(() => normalizeCompactListMarkers(props.source))
</script>

<template>
  <MarkdownRender
    class="markdown-body"
    :content="markdown"
    :final="!props.isStreaming"
    mode="chat"
    html-policy="escape"
    :typewriter="props.isStreaming"
    :batch-rendering="true"
    :render-batch-size="16"
    :render-batch-delay="8"
    :render-batch-budget-ms="4"
    :fade="false"
  />
</template>
