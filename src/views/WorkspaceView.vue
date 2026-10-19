<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Calendar, DocumentChecked, House, Position } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ConversationMessage from '@/components/ConversationMessage.vue'
import MessageComposer from '@/components/MessageComposer.vue'
import TravelBrand from '@/components/TravelBrand.vue'
import TravelWorkflowBlock from '@/components/TravelWorkflowBlock.vue'
import { useConversationStore } from '@/store/conversation'
import { useWorkflowStore } from '@/store/workflow'
import type { WorkflowBlock } from '@/types/workflow'
import { appConfig } from '@/config'

const conversations = useConversationStore()
const workflow = useWorkflowStore()
const scroller = ref<HTMLElement>()
const composer = ref<InstanceType<typeof MessageComposer>>()
const autoScroll = ref(true)
const hasMessages = computed(() => conversations.messages.length > 0)
const workflowBlocks = computed(() => {
  if (!appConfig.features.travelWorkflow) return []
  const ids = new Set(conversations.workflowEvents.map((event) => (event.payload as Partial<WorkflowBlock> | undefined)?.workflowId).filter(Boolean))
  return Object.values(workflow.blocks).filter((block) => ids.has(block.workflowId))
})
const starters = [
  { label: '规划出差', icon: Calendar, text: '帮我规划一次出差，出发城市是，目的地是，出行日期是' },
  { label: '查询差标', icon: DocumentChecked, text: '帮我查询公司差旅标准，我的出差目的地是' },
  { label: '安排交通', icon: Position, text: '帮我比较出差的交通方案，出发地是，目的地是，日期是' },
  { label: '查找住宿', icon: House, text: '帮我查找符合公司差标的酒店，出差城市是，入住日期是' },
]

function trackScroll() {
  const el = scroller.value
  if (el) autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 100
}
watch(() => conversations.messages.map((message) => message.content).join(''), async () => {
  await nextTick()
  if (scroller.value && autoScroll.value) scroller.value.scrollTop = scroller.value.scrollHeight
})
watch(() => conversations.activeId, () => { autoScroll.value = true })
watch(() => conversations.workflowEvents.length, async () => {
  for (const event of conversations.workflowEvents) {
    if (event.type === 'workflow.update' || event.type === 'action.confirmation_required') {
      const payload = event.payload as unknown as Partial<WorkflowBlock>
      if (payload.workflowId && payload.status) workflow.upsert(payload as WorkflowBlock)
    }
  }
  await nextTick()
  if (scroller.value && autoScroll.value) scroller.value.scrollTop = scroller.value.scrollHeight
}, { immediate: true })

async function send(text: string) {
  autoScroll.value = true
  try { await conversations.send(text) } catch { composer.value?.setDraft(text); ElMessage.error('消息发送失败，请稍后重试') }
}
function starter(text: string) { composer.value?.setDraft(text) }
</script>

<template>
  <div class="workspace" :class="{ 'is-empty': !hasMessages }">
    <section ref="scroller" class="message-scroll" aria-label="差旅对话" :aria-busy="conversations.sending" @scroll.passive="trackScroll">
      <div v-if="!hasMessages" class="welcome">
        <div class="welcome-brand"><TravelBrand mark-only /><span>企业差旅助手</span></div>
        <h1>这次出差，有什么可以帮你？</h1>
        <p>查询差旅标准、规划出行安排，让每一步都有依据。</p>
      </div>
      <div v-else class="message-thread"><ConversationMessage v-for="message in conversations.messages" :key="message.id" :message="message" @retry="conversations.retry" /><TravelWorkflowBlock v-for="block in workflowBlocks" :key="block.workflowId" :block="block" @confirm="workflow.confirm" @cancel="workflow.cancel" /></div>
    </section>
    <div class="composer-dock">
      <MessageComposer ref="composer" :key="conversations.activeId ?? 'new'" :sending="conversations.sending" @send="send" @stop="conversations.stop" />
      <div v-if="!hasMessages" class="starter-list" aria-label="常用差旅需求"><button v-for="item in starters" :key="item.label" @click="starter(item.text)"><el-icon><component :is="item.icon" /></el-icon>{{ item.label }}</button></div>
      <p v-if="hasMessages" class="conversation-disclaimer">差旅建议仅供参考，预订与报销请以企业政策及实际确认为准。</p>
    </div>
    <footer v-if="!hasMessages" class="workspace-footer">差旅建议仅供参考，预订与报销请以企业政策及实际确认为准。</footer>
  </div>
</template>

<style scoped>
.workspace { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.message-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 36px 12px; overscroll-behavior: contain; scrollbar-gutter: stable; }
.message-thread { max-width: 800px; margin: 0 auto; }
.welcome { width: 100%; max-width: 800px; margin: 0 auto; padding: 16px 0 32px; text-align: center; }
.welcome-brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 24px; color: var(--text); font-size: 17px; font-weight: 500; }
.welcome h1 { margin: 0 0 14px; color: var(--text); font-size: clamp(24px, 2.3vw, 30px); font-weight: 550; letter-spacing: -.03em; line-height: 1.5; }
.welcome p { margin: 0; color: var(--text-muted); font-size: 14px; line-height: 1.9; }
.composer-dock { width: 100%; max-width: 872px; flex-shrink: 0; margin: 0 auto; padding: 8px 36px 0; }
.starter-list { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.starter-list button { display: flex; align-items: center; gap: 8px; padding: 9px 15px; border: 1px solid var(--line); border-radius: 7px; background: white; color: #596477; font-size: 12px; cursor: pointer; }
.starter-list button .el-icon { color: #7d8ca5; font-size: 15px; }.starter-list button:hover { color: var(--accent); border-color: #b7c7eb; background: #fafbfe; }
.conversation-disclaimer, .workspace-footer { margin: 12px 0 13px; color: #818a99; font-size: 11px; line-height: 1.7; text-align: center; }
.is-empty .message-scroll { display: flex; flex: 1; align-items: flex-end; }
.is-empty .composer-dock { flex: 1; padding-top: 0; }
.workspace-footer { flex-shrink: 0; padding: 0 20px; margin-bottom: 18px; }
@media (max-width: 720px) { .message-scroll { padding: 20px 18px 6px; }.composer-dock { padding: 8px 18px 0; }.welcome { padding-bottom: 24px; }.welcome-brand { margin-bottom: 18px; }.welcome h1 { font-size: 24px; }.welcome p { max-width: 280px; margin: 0 auto; font-size: 13px; }.starter-list { gap: 8px; margin-top: 18px; }.starter-list button { padding: 9px 11px; }.conversation-disclaimer { font-size: 10px; margin-bottom: 9px; } }
@media (max-width: 420px) { .starter-list { display: grid; grid-template-columns: repeat(2, 1fr); }.starter-list button { justify-content: center; }.welcome h1 { font-size: 21px; }.workspace-footer { font-size: 10px; }.welcome-brand { font-size: 15px; } }
@media (max-height: 650px) { .is-empty .message-scroll { flex: 1; min-height: 160px; }.is-empty .composer-dock { flex: 0; }.welcome-brand { margin-bottom: 12px; }.welcome { padding-bottom: 20px; }.workspace-footer { margin: 16px 0 10px; } }
</style>
