<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, CopyDocument, Refresh } from '@element-plus/icons-vue'
import TravelBrand from './TravelBrand.vue'
import UserAvatar from './UserAvatar.vue'
import MarkdownContent from './MarkdownContent.vue'
import AskUserPrompt from './AskUserPrompt.vue'
import AgentProgressTimeline from './AgentProgressTimeline.vue'
import AgentPlanList from './AgentPlanList.vue'
import IntentProgressTimeline from './IntentProgressTimeline.vue'
import type { User } from '@/types/auth'
import type { ConversationMessage } from '@/types/conversation'
import { formatDate } from '@/utils/format'

const props = defineProps<{ message: ConversationMessage; user?: User | null }>()
const emit = defineEmits<{ retry: [message: ConversationMessage]; askSubmit: [message: ConversationMessage, value: unknown, display: string] }>()
const isUser = computed(() => props.message.role === 'user')
const displayName = computed(() => props.user?.nickName?.trim() || props.user?.username || '用户')
const showStreamStatus = computed(() => props.message.status === 'streaming' && !props.message.toolCalls?.some((tool) => tool.status === 'running') && !props.message.agentOutputs?.some((output) => output.status === 'running'))
async function copy() {
  try { await navigator.clipboard.writeText(props.message.content); ElMessage.success('已复制回复') } catch { ElMessage.error('复制失败，请手动选择内容复制') }
}
</script>

<template>
  <article class="message-row" :class="{ 'is-user': isUser }" :aria-label="isUser ? '我的消息' : '途灵回复'">
    <div v-if="!isUser" class="assistant-identity"><TravelBrand mark-only /><strong>途灵</strong><span v-if="showStreamStatus" class="stream-status" role="status">正在整理…</span></div>
    <div class="message-content">
      <div v-if="!isUser && (message.intentEvents?.length || message.toolCalls?.length)" class="assistant-progress">
        <IntentProgressTimeline :events="message.intentEvents" :connect-to-tools="Boolean(message.toolCalls?.length)" />
        <span v-if="message.intentEvents?.length && message.toolCalls?.length" class="progress-connector" aria-hidden="true"></span>
        <AgentProgressTimeline :tools="message.toolCalls" :status="message.status" />
      </div>
      <AgentPlanList v-if="!isUser && message.plans?.length" :plans="message.plans" />
      <div class="message-bubble"><MarkdownContent v-if="!isUser && message.content" :source="message.content" :is-streaming="message.status === 'streaming'" /><p v-else-if="isUser">{{ message.content }}</p><p v-else-if="message.status === 'streaming' && !message.intentEvents?.length && !message.toolCalls?.length && !message.agentOutputs?.length && !message.plans?.length" class="stream-placeholder">正在整理你的需求…</p></div>
      <AskUserPrompt v-if="!isUser && message.ask" :prompt="message.ask" :submitted="message.askStatus === 'submitted'" @submit="(value, display) => emit('askSubmit', message, value, display)" />
      <div v-if="message.status === 'failed'" class="message-error" role="alert"><span>{{ message.error || '响应失败，请重试' }}</span><el-button link type="primary" :icon="Refresh" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="message.status === 'cancelled'" class="message-error"><span>已停止生成</span><el-button link type="primary" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="!isUser && message.content && message.status === 'completed'" class="message-tools"><button class="icon-button" aria-label="复制回复" title="复制回复" @click="copy"><el-icon><CopyDocument /></el-icon></button><span><el-icon><Check /></el-icon>回复完成</span></div>
      <time v-if="isUser && message.createTime" class="message-time">{{ formatDate(message.createTime) }}</time>
    </div>
    <UserAvatar v-if="isUser" class="message-user-avatar" :src="user?.avatar" :name="displayName" :size="32" />
  </article>
</template>

<style scoped>
.message-row { display: flex; width: 100%; flex-direction: column; align-items: flex-start; margin: 0 0 32px; }
.assistant-identity { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.assistant-identity :deep(.travel-mark) { width: 25px; height: 25px; }
.assistant-identity strong { color: var(--text); font-size: 13px; font-weight: 600; }
.stream-status { color: var(--text-muted); font-size: 11px; }
.message-content { width: min(100%, 800px); min-width: 0; }
.assistant-progress { --progress-connector-height: 22px; width: 100%; }
.progress-connector { display: block; height: var(--progress-connector-height); }
.message-bubble { padding: 0; }
.message-bubble p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.85; font-size: 14px; }
.is-user { flex-direction: row; align-items: flex-start; justify-content: flex-end; padding-left: 0; gap: 9px; }
.is-user .message-content { width: auto; max-width: min(calc(100% - 41px), 620px); }
.is-user .message-bubble { padding: 12px 18px; border-radius: 12px; background: #f1f3f7; color: #354156; }
.message-user-avatar { margin-top: 2px; }
.message-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; color: #a14b48; font-size: 12px; }
.message-tools { display: flex; align-items: center; gap: 9px; margin: 10px 0 0 -6px; color: #9199a7; }
.message-tools .icon-button { width: 27px; height: 27px; font-size: 14px; }
.message-tools > span { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.message-time { display: block; margin-top: 8px; color: #9199a7; text-align: right; font-size: 10px; }
@media (max-width: 720px) { .message-row { margin-bottom: 25px; }.is-user { padding-left: 0; }.is-user .message-content { max-width: calc(100% - 41px); } }
</style>
