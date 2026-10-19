<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { Top, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{ sending: boolean }>()
const emit = defineEmits<{ send: [value: string]; stop: [] }>()
const value = ref('')
const input = ref<HTMLTextAreaElement>()

function resize() {
  if (!input.value) return
  input.value.style.height = 'auto'
  input.value.style.height = Math.min(188, Math.max(52, input.value.scrollHeight)) + 'px'
}
watch(value, resize, { flush: 'post' })
onMounted(resize)

function submit() {
  if (props.sending || !value.value.trim()) return
  emit('send', value.value.trim())
  value.value = ''
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
}
async function setDraft(text: string) { value.value = text; await nextTick(); input.value?.focus() }
defineExpose({ setDraft })
</script>

<template>
  <div class="composer" :class="{ 'is-sending': sending }">
    <textarea ref="input" v-model="value" rows="2" maxlength="20000" aria-label="差旅需求" placeholder="告诉我你的出发地、目的地和出行日期…" @keydown="keydown" />
    <div class="composer-actions"><span class="composer-context"><span class="context-dot" />企业差旅咨询</span><span class="composer-keyboard">Enter 发送，Shift + Enter 换行</span><el-button v-if="sending" class="stop-button" :icon="VideoPause" aria-label="停止生成" @click="emit('stop')">停止生成</el-button><el-button v-else class="send-button" type="primary" :icon="Top" :disabled="!value.trim()" aria-label="发送消息" title="发送消息" @click="submit" /></div>
  </div>
</template>

<style scoped>
.composer { padding: 17px 18px 12px; border: 1px solid #dce1e9; border-radius: 14px; background: #fff; box-shadow: 0 3px 14px #25304405; }
.composer:focus-within { border-color: #8fa9e5; box-shadow: 0 0 0 3px #315eca07; }
.composer textarea { display: block; width: 100%; min-height: 52px; max-height: 188px; padding: 0; resize: none; border: 0; outline: 0; box-shadow: none; border-radius: 0; background: transparent; color: var(--text); font-size: 14px; line-height: 1.8; }
.composer textarea::placeholder { color: #929aa8; }
.composer-actions { display: flex; align-items: center; gap: 14px; margin-top: 13px; min-height: 32px; }
.composer-context { display: flex; align-items: center; gap: 7px; color: #687386; font-size: 11px; }
.context-dot { width: 5px; height: 5px; border-radius: 50%; background: #7d8da7; }
.composer-keyboard { margin-left: auto; color: #9199a7; font-size: 10px; }
.send-button { width: 32px; height: 32px; padding: 0; border-radius: 8px; }
.send-button :deep(.el-icon) { font-size: 19px; }.send-button.is-disabled { border-color: #e9edf4; background: #e9edf4; color: #9ba8bf; }
.stop-button { height: 32px; border-radius: 7px; font-size: 12px; }
@media (max-width: 720px) { .composer { padding: 14px 14px 10px; }.composer-keyboard { display: none; }.send-button, .stop-button { margin-left: auto; }.composer-context { font-size: 10px; } }
</style>
