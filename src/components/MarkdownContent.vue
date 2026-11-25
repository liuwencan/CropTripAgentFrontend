<script setup lang="ts">
import { MarkdownRenderer } from 'x-markdown-vue'
import 'katex/dist/katex.min.css'
import 'x-markdown-vue/style'

const props = withDefaults(defineProps<{ source: string; isStreaming?: boolean }>(), { isStreaming: false })
</script>

<template>
  <MarkdownRenderer
    class="x-md-renderer markdown-body"
    :markdown="props.source"
    :allow-html="false"
    :sanitize="true"
    :enable-animate="props.isStreaming"
    :style="{ backgroundColor: 'transparent', color: 'inherit', padding: '0' }"
  />
</template>
