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
const emit = defineEmits<{ retry: [message: ConversationMessage]; askSubmit: [message: ConversationMessage, value: unknown, display: string]; recommendSelect: [question: string] }>()
const isUser = computed(() => props.message.role === 'user')
const displayName = computed(() => props.user?.nickName?.trim() || props.user?.username || '用户')
const showStreamStatus = computed(() => props.message.status === 'streaming' && !props.message.toolCalls?.some((tool) => tool.status === 'running') && !props.message.agentOutputs?.some((output) => output.status === 'running'))
function isPayableUrl(value?: string) {
  if (!value) return false
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}
function openPayment(url?: string) {
  if (isPayableUrl(url)) window.open(url, '_blank', 'noopener,noreferrer')
}
function currencyLabel(currency?: string) {
  if (!currency || currency === 'CNY' || currency === 'RMB') return '¥'
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  if (currency === 'HKD') return 'HK$'
  return currency
}
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
      <div v-if="!isUser && message.bookingResults?.length" class="booking-results" aria-label="预订结果">
        <article v-for="(booking, index) in message.bookingResults" :key="booking.orderId || booking.payUrl || `${booking.title}-${index}`" class="booking-card">
          <div class="booking-card-heading">
            <div class="booking-card-title"><span class="booking-card-kicker">{{ booking.bizTypeLabel || '预订' }}</span><strong>{{ booking.title || '预订订单' }}</strong></div>
            <span class="booking-status">{{ booking.statusLabel || '待支付' }}</span>
          </div>
          <div class="booking-card-meta">
            <span v-if="booking.orderId">订单号 {{ booking.orderId }}</span>
            <span v-if="booking.amount" class="booking-amount">{{ currencyLabel(booking.currency) }}{{ booking.amount }}</span>
          </div>
          <button class="booking-pay-button" type="button" :disabled="!isPayableUrl(booking.payUrl)" @click="openPayment(booking.payUrl)">立即支付</button>
        </article>
      </div>
      <div v-if="message.status === 'failed'" class="message-error" role="alert"><span>{{ message.error || '响应失败，请重试' }}</span><el-button link type="primary" :icon="Refresh" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="message.status === 'cancelled'" class="message-error"><span v-if="!message.content">已暂停生成</span><el-button link type="primary" @click="emit('retry', message)">重新生成</el-button></div>
      <div v-else-if="!isUser && message.content && message.status === 'completed'" class="message-tools"><button class="icon-button" aria-label="复制回复" title="复制回复" @click="copy"><el-icon><CopyDocument /></el-icon></button><span><el-icon><Check /></el-icon>回复完成</span></div>
      <div v-if="!isUser && message.status === 'completed' && message.recommendedQuestions?.length" class="recommended-questions" aria-label="推荐问题">
        <span class="recommended-questions-label">你还可以继续问</span>
        <button v-for="question in message.recommendedQuestions" :key="question" type="button" class="recommended-question" @click="emit('recommendSelect', question)">{{ question }}</button>
      </div>
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
.booking-results { display: grid; gap: 12px; margin-top: 16px; }
.booking-card { width: min(100%, 420px); padding: 16px; border: 1px solid #dce4f2; border-radius: 8px; background: #fbfcff; box-shadow: 0 5px 16px rgba(43, 65, 103, .06); }
.booking-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.booking-card-title { min-width: 0; display: grid; gap: 5px; }
.booking-card-title strong { color: var(--text); font-size: 14px; font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.booking-card-kicker { color: var(--accent); font-size: 11px; }
.booking-status { flex-shrink: 0; padding: 3px 7px; border-radius: 4px; background: #fff4df; color: #9b6819; font-size: 11px; }
.booking-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 13px; color: var(--text-muted); font-size: 11px; }
.booking-card-meta span:first-child { min-width: 0; overflow-wrap: anywhere; }
.booking-amount { flex-shrink: 0; color: var(--text); font-size: 16px; font-weight: 600; }
.booking-pay-button { width: 100%; min-height: 36px; margin-top: 14px; border: 0; border-radius: 6px; background: var(--accent); color: white; font-size: 13px; cursor: pointer; transition: background .16s ease; }
.booking-pay-button:hover:not(:disabled) { background: #274ba2; }
.booking-pay-button:disabled { background: #b8c1d2; color: #f8f9fb; cursor: not-allowed; }
.recommended-questions { display: grid; gap: 8px; margin-top: 16px; }
.recommended-questions-label { color: var(--text-muted); font-size: 11px; }
.recommended-question { width: fit-content; max-width: 100%; padding: 8px 12px; border: 1px solid #d8e0ee; border-radius: 6px; background: #fff; color: #45619b; font-size: 12px; line-height: 1.5; text-align: left; cursor: pointer; overflow-wrap: anywhere; transition: border-color .16s ease, background .16s ease; }
.recommended-question:hover { border-color: #9eb4e4; background: #f7f9fe; }
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
