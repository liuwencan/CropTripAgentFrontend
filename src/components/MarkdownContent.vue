<script setup lang="ts">
import { MarkdownRenderer } from 'x-markdown-vue'
import 'katex/dist/katex.min.css'
import 'x-markdown-vue/style'

defineProps<{ source: string }>()
</script>

<template>
  <MarkdownRenderer
    class="x-md-renderer markdown-body"
    :markdown="source"
    :allow-html="false"
    :sanitize="true"
    :style="{ backgroundColor: 'transparent', color: 'inherit', padding: '0' }"
  />
</template>
