<script setup lang="ts">
import { ref } from 'vue'
import { Promotion, VideoPause } from '@element-plus/icons-vue'

defineProps<{ sending: boolean }>()
const emit = defineEmits<{ send: [value: string]; stop: [] }>()
const value = ref('')

function submit() { if (value.value.trim()) { emit('send', value.value); value.value = '' } }
function keydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }
</script>

<template>
  <div class="composer">
    <el-input v-model="value" type="textarea" :rows="3" resize="none" maxlength="20000" show-word-limit placeholder="描述你的差旅需求，例如：下周一从上海去北京出差两天" @keydown="keydown" />
    <div class="composer-actions"><span class="muted">Enter 发送 · Shift + Enter 换行</span><el-button v-if="sending" type="danger" plain :icon="VideoPause" @click="emit('stop')">停止生成</el-button><el-button v-else type="primary" :icon="Promotion" @click="submit">发送</el-button></div>
  </div>
</template>

<style scoped>
.composer { padding: 14px; border: 1px solid #d8e4e0; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(25, 69, 61, .06); }
.composer-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
@media (max-width: 520px) { .composer-actions { align-items: flex-end; gap: 10px; flex-direction: column; } }
</style>
