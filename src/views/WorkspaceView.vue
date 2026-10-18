<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ChatLineRound, Plus, Clock, ArrowDown } from '@element-plus/icons-vue'
import ConversationMessage from '@/components/ConversationMessage.vue'
import MessageComposer from '@/components/MessageComposer.vue'
import TravelWorkflowBlock from '@/components/TravelWorkflowBlock.vue'
import { useConversationStore } from '@/store/conversation'
import { useWorkflowStore } from '@/store/workflow'
import type { WorkflowBlock } from '@/types/workflow'

const conversations = useConversationStore()
const workflow = useWorkflowStore()
const scroller = ref<HTMLElement>()
const workflowBlocks = ref<WorkflowBlock[]>([])
const activeTitle = computed(() => conversations.activeConversation?.title || '新的差旅咨询')

onMounted(() => conversations.loadConversations())
watch(() => conversations.messages.length, async () => { await nextTick(); if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight })
watch(() => conversations.workflowEvents.length, () => {
  const event = conversations.workflowEvents.at(-1)
  if (event && (event.type === 'workflow.update' || event.type === 'action.confirmation_required')) {
    const payload = event.payload as unknown as Partial<WorkflowBlock>
    if (payload.workflowId && payload.status) workflow.upsert(payload as WorkflowBlock)
  }
})
watch(() => workflow.blocks, (value) => { workflowBlocks.value = Object.values(value) }, { deep: true })

function starter(text: string) { conversations.send(text) }
</script>

<template>
  <div class="workspace page-section">
    <div class="workspace-heading"><div><p class="eyebrow">EMPLOYEE WORKSPACE</p><h1>今天，准备去哪？</h1><p class="muted">把差旅需求交给我，我会帮你梳理政策、行程和下一步。</p></div><el-button plain :icon="Plus" @click="conversations.createConversation">新建会话</el-button></div>
    <div class="workspace-grid">
      <aside class="conversation-list"><div class="list-title"><span>最近会话</span><el-icon><Clock /></el-icon></div><button v-for="item in conversations.conversations" :key="item.id" class="conversation-item" :class="{ active: item.id === conversations.activeId }" @click="conversations.selectConversation(item.id)"><el-icon><ChatLineRound /></el-icon><span>{{ item.title }}</span></button><div v-if="!conversations.conversations.length" class="empty-list">暂无历史会话</div></aside>
      <section class="chat-panel"><div class="chat-header"><div><strong>{{ activeTitle }}</strong><span class="status-dot">在线</span></div><span class="muted">企业差旅助手</span></div><div ref="scroller" class="message-scroll"><div v-if="!conversations.messages.length" class="welcome"><div class="welcome-icon">行</div><h2>告诉我你的出差计划</h2><p class="muted">我可以帮你查询差旅政策、比较行程，并整理需要确认的事项。</p><div class="starter-grid"><button @click="starter('我下周一要从上海去北京出差两天')">规划一段出差行程 <ArrowDown /></button><button @click="starter('帮我查询北京出差的差旅标准')">查询差旅政策 <ArrowDown /></button></div></div><template v-else><ConversationMessage v-for="message in conversations.messages" :key="message.id" :message="message" @retry="conversations.retry" /><TravelWorkflowBlock v-for="block in workflowBlocks" :key="block.workflowId" :block="block" /></template></div><MessageComposer :sending="conversations.sending" @send="conversations.send" @stop="conversations.stop" /></section>
    </div>
  </div>
</template>

<style scoped>
.workspace-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }.eyebrow { margin: 0 0 8px; color: #6f8b86; font-size: 11px; letter-spacing: .16em; }.workspace-heading h1 { margin: 0 0 6px; color: #173b38; font-size: 30px; }.workspace-grid { display: grid; grid-template-columns: 230px minmax(0, 1fr); min-height: 620px; border: 1px solid #dce7e3; border-radius: 12px; overflow: hidden; background: #fff; }.conversation-list { padding: 18px 12px; background: #f8fbfa; border-right: 1px solid #e2ebe8; }.list-title { display: flex; align-items: center; justify-content: space-between; padding: 0 8px 12px; color: #58756e; font-size: 12px; font-weight: 700; }.conversation-item { display: flex; align-items: center; gap: 8px; width: 100%; margin: 3px 0; padding: 10px 8px; border: 0; border-radius: 7px; background: transparent; color: #516b65; text-align: left; cursor: pointer; }.conversation-item:hover, .conversation-item.active { background: #e0f1eb; color: #126d5d; }.conversation-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.empty-list { padding: 20px 8px; color: #9aa9a5; font-size: 12px; }.chat-panel { display: flex; min-width: 0; flex-direction: column; }.chat-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid #e8efed; }.chat-header strong { color: #264740; }.status-dot { margin-left: 10px; color: #23856b; font-size: 11px; }.status-dot::before { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: #42bb91; content: ''; }.message-scroll { flex: 1; min-height: 420px; max-height: 610px; overflow-y: auto; padding: 28px 22px 8px; }.welcome { display: flex; height: 100%; min-height: 430px; flex-direction: column; align-items: center; justify-content: center; text-align: center; }.welcome-icon { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 14px; background: #d9eee7; color: #14725f; font-size: 24px; font-weight: 700; }.welcome h2 { margin: 16px 0 5px; color: #24483f; }.starter-grid { display: grid; grid-template-columns: repeat(2, minmax(160px, 1fr)); gap: 10px; margin-top: 24px; }.starter-grid button { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid #d9e7e2; border-radius: 8px; background: #fff; color: #44635c; font-size: 12px; text-align: left; cursor: pointer; }.starter-grid button:hover { border-color: #72bea9; color: #12705f; } .chat-panel > .composer { margin: 0 22px 22px; }
@media (max-width: 800px) { .workspace-grid { grid-template-columns: 1fr; }.conversation-list { display: flex; gap: 8px; overflow-x: auto; border-right: 0; border-bottom: 1px solid #e2ebe8; }.list-title { display: none; }.conversation-item { flex: 0 0 auto; width: auto; }.message-scroll { max-height: none; }.starter-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .workspace-heading { align-items: flex-start; gap: 12px; flex-direction: column; }.workspace-heading h1 { font-size: 26px; }.chat-header { padding: 14px; }.message-scroll { padding: 22px 14px 8px; }.chat-panel > .composer { margin: 0 14px 14px; } }
</style>
