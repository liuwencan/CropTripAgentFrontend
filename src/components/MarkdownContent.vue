<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MarkdownRenderer } from 'x-markdown-vue'
import type { PlanHtmlPayload } from '@/types/conversation'
import 'katex/dist/katex.min.css'
import 'x-markdown-vue/style'

const props = withDefaults(defineProps<{ source: string; isStreaming?: boolean; planHtml?: PlanHtmlPayload }>(), { isStreaming: false })
const planFrame = ref<HTMLIFrameElement>()
let planResizeObserver: ResizeObserver | undefined

function resizePlanFrame() {
  const frame = planFrame.value
  const document = frame?.contentDocument
  if (!frame || !document) return
  const height = Math.ceil(Math.max(
    document.documentElement?.scrollHeight ?? 0,
    document.documentElement?.offsetHeight ?? 0,
    document.body?.scrollHeight ?? 0,
    document.body?.offsetHeight ?? 0,
  ))
  if (height > 0) frame.style.height = `${height}px`
}

function observePlanFrame() {
  planResizeObserver?.disconnect()
  planResizeObserver = undefined
  resizePlanFrame()
  const body = planFrame.value?.contentDocument?.body
  if (body && typeof ResizeObserver !== 'undefined') {
    planResizeObserver = new ResizeObserver(resizePlanFrame)
    planResizeObserver.observe(body)
  }
}

watch(() => props.planHtml?.html, async () => {
  await nextTick()
  observePlanFrame()
})
onBeforeUnmount(() => planResizeObserver?.disconnect())
</script>

<template>
  <div class="markdown-content">
    <MarkdownRenderer
      class="x-md-renderer markdown-body"
      :markdown="props.source"
      :allow-html="false"
      :sanitize="true"
      :enable-animate="props.isStreaming"
      :style="{ backgroundColor: 'transparent', color: 'inherit', padding: '0' }"
    />
    <iframe
      v-if="props.planHtml"
      ref="planFrame"
      class="markdown-plan-html"
      :srcdoc="props.planHtml.html"
      :title="props.planHtml.title"
      sandbox="allow-same-origin"
      scrolling="no"
      referrerpolicy="no-referrer"
      @load="observePlanFrame"
    ></iframe>
  </div>
</template>

<style scoped>
.markdown-content { width: 100%; min-width: 0; }
.markdown-plan-html { display: block; width: 100%; height: 1px; min-height: 1px; margin: 8px 0 0; overflow: hidden; border: 0; background: #fff; }
</style>
