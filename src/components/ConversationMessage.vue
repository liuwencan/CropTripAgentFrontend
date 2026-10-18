<script setup lang="ts">
import { computed } from 'vue'
import { Refresh, User, Service } from '@element-plus/icons-vue'
import MarkdownContent from './MarkdownContent.vue'
import type { ConversationMessage } from '@/types/conversation'
import { formatDate } from '@/utils/format'

const props = defineProps<{ message: ConversationMessage }>()
const emit = defineEmits<{ retry: [message: ConversationMessage] }>()
const isUser = computed(() => props.message.role === 'user')
</script>

<template>
  <article class="message-row" :class="{ 'is-user': isUser }">
    <div class="avatar"><el-icon><User v-if="isUser" /><Service v-else /></el-icon></div>
    <div class="message-content">
      <div class="message-meta"><strong>{{ isUser ? '我' : '差旅助手' }}</strong><span>{{ formatDate(message.createTime) }}</span><el-tag v-if="message.status === 'streaming'" size="small" type="success">生成中</el-tag></div>
      <div class="message-bubble"><MarkdownContent v-if="!isUser" :source="message.content || '正在整理你的需求…'" /><p v-else>{{ message.content }}</p></div>
      <div v-if="message.status === 'failed'" class="message-error"><span>{{ message.error || '响应失败' }}</span><el-button link type="danger" :icon="Refresh" @click="emit('retry', message)">重试</el-button></div>
      <div v-if="message.status === 'cancelled'" class="message-error"><span>已停止生成</span><el-button link type="primary" @click="emit('retry', message)">继续生成</el-button></div>
    </div>
  </article>
</template>

<style scoped>
.message-row { display: flex; gap: 12px; max-width: 860px; margin: 0 auto 22px; }
.message-row.is-user { flex-direction: row-reverse; }
.avatar { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: #d8eee7; color: #167361; }
.is-user .avatar { background: #dce7f4; color: #28669b; }
.message-content { min-width: 0; flex: 1; }
.message-meta { display: flex; align-items: center; gap: 8px; margin: 0 0 7px; color: #6a817c; font-size: 12px; }
.is-user .message-meta { justify-content: flex-end; }
.message-meta strong { color: #25443f; font-size: 13px; }
.message-bubble { padding: 14px 16px; border: 1px solid #e0e9e6; border-radius: 4px 14px 14px 14px; background: #fff; box-shadow: 0 4px 14px rgba(25, 69, 61, .04); }
.is-user .message-bubble { border-color: #c9dfef; border-radius: 14px 4px 14px 14px; background: #eaf4fb; }
.message-bubble p { margin: 0; white-space: pre-wrap; line-height: 1.7; }
.message-error { display: flex; align-items: center; gap: 8px; margin-top: 5px; color: #b34d3b; font-size: 12px; }
</style>
