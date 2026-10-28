<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, CopyDocument, Loading, Refresh } from '@element-plus/icons-vue'
import TravelBrand from './TravelBrand.vue'
import MarkdownContent from './MarkdownContent.vue'
import AskUserPrompt from './AskUserPrompt.vue'
import type { ConversationMessage, ToolCall } from '@/types/conversation'
import { formatDate } from '@/utils/format'

const props = defineProps<{ message: ConversationMessage }>()
const emit = defineEmits<{ retry: [message: ConversationMessage]; askSubmit: [message: ConversationMessage, value: unknown, display: string] }>()
const isUser = computed(() => props.message.role === 'user')
function formatToolResult(result: ToolCall['result']): string {
  if (result === undefined || result === null) return ''
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as unknown
      return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
    } catch {
      return result
    }
  }
  return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
}
async function copy() {
  try { await navigator.clipboard.writeText(props.message.content); ElMessage.success('已复制回复') } catch { ElMessage.error('复制失败，请手动选择内容复制') }
}
</script>

<template>
  <article class="message-row" :class="{ 'is-user': isUser }" :aria-label="isUser ? '我的消息' : '差旅助手回复'">
    <div v-if="!isUser" class="assistant-identity"><TravelBrand mark-only /><strong>差旅助手</strong><span v-if="message.status === 'streaming'" class="stream-status" role="status">正在整理…</span></div>
    <div class="message-content">
      <div v-if="!isUser && message.toolCalls?.length" class="tool-call-list" aria-label="工具调用">
        <div v-for="tool in message.toolCalls" :key="tool.toolCallId" class="tool-call" :class="{ 'is-success': tool.status === 'success' }">
          <div class="tool-call-header" role="status">
            <el-icon v-if="tool.status === 'success'" class="tool-success"><Check /></el-icon>
            <el-icon v-else class="tool-spinner is-loading"><Loading /></el-icon>
            <strong>{{ tool.toolName }}</strong>
            <span>{{ tool.status === 'success' ? '执行完成' : '正在执行' }}</span>
          </div>
          <pre v-if="tool.result !== undefined" class="tool-result">{{ formatToolResult(tool.result) }}</pre>
        </div>
      </div>
      <div class="message-bubble"><MarkdownContent v-if="!isUser && message.content" :source="message.content" /><p v-else-if="isUser">{{ message.content }}</p><p v-else-if="message.status === 'streaming'" class="stream-placeholder">正在整理你的需求…</p></div>
      <AskUserPrompt v-if="!isUser && message.ask" :prompt="message.ask" :submitted="message.askStatus === 'submitted'" @submit="(value, display) => emit('askSubmit', message, value, display)" />
      <div v-if="message.status === 'failed'" class="message-error" role="alert"><span>{{ message.error || '响应失败，请重试' }}</span><el-button link type="primary" :icon="Refresh" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="message.status === 'cancelled'" class="message-error"><span>已停止生成</span><el-button link type="primary" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="!isUser && message.content && message.status === 'completed'" class="message-tools"><button class="icon-button" aria-label="复制回复" title="复制回复" @click="copy"><el-icon><CopyDocument /></el-icon></button><span><el-icon><Check /></el-icon>回复完成</span></div>
      <time v-if="isUser && message.createTime" class="message-time">{{ formatDate(message.createTime) }}</time>
    </div>
  </article>
</template>

<style scoped>
.message-row { display: flex; width: 100%; flex-direction: column; align-items: flex-start; margin: 0 0 32px; }
.assistant-identity { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.assistant-identity :deep(.travel-mark) { width: 25px; height: 25px; }
.assistant-identity strong { color: var(--text); font-size: 13px; font-weight: 600; }
.stream-status { color: var(--text-muted); font-size: 11px; }
.message-content { width: min(100%, 800px); min-width: 0; }
.message-bubble { padding: 0; }
.message-bubble p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.85; font-size: 14px; }
.tool-call-list { display: grid; gap: 8px; margin: 0 0 14px; }
.tool-call { max-width: 100%; padding: 9px 12px; border: 1px solid #e5e8ee; border-radius: 7px; background: #fafbfc; color: #586275; }
.tool-call-header { display: flex; align-items: center; gap: 7px; min-height: 18px; font-size: 12px; }
.tool-call-header strong { color: #354156; font-weight: 600; overflow-wrap: anywhere; }
.tool-call-header span { color: #929aaa; font-size: 11px; }
.tool-spinner { color: var(--accent); animation: tool-spin 1s linear infinite; }
.tool-success { color: #4a8f73; }
.tool-result { margin: 8px 0 0 22px; color: #6d7789; font: inherit; font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
@keyframes tool-spin { to { transform: rotate(360deg); } }
.is-user { align-items: flex-end; padding-left: 0; }
.is-user .message-content { width: auto; max-width: min(85%, 620px); }
.is-user .message-bubble { padding: 12px 18px; border-radius: 12px; background: #f1f3f7; color: #354156; }
.message-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; color: #a14b48; font-size: 12px; }
.message-tools { display: flex; align-items: center; gap: 9px; margin: 10px 0 0 -6px; color: #9199a7; }
.message-tools .icon-button { width: 27px; height: 27px; font-size: 14px; }
.message-tools > span { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.message-time { display: block; margin-top: 8px; color: #9199a7; text-align: right; font-size: 10px; }
@media (max-width: 720px) { .message-row { margin-bottom: 25px; }.is-user { padding-left: 20px; }.is-user .message-content { max-width: 95%; } }
</style>
