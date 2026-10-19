<script setup lang="ts">
import { Check, Close, WarningFilled } from '@element-plus/icons-vue'
import type { WorkflowBlock } from '@/types/workflow'

const props = defineProps<{ block: WorkflowBlock }>()
const emit = defineEmits<{ confirm: [action: NonNullable<WorkflowBlock['action']>]; cancel: [action: NonNullable<WorkflowBlock['action']>] }>()
</script>

<template>
  <div class="workflow-block">
    <div v-if="block.policy" class="policy" :class="{ passed: block.policy.compliant }"><el-icon><Check v-if="block.policy.compliant" /><WarningFilled v-else /></el-icon><div><strong>{{ block.policy.title }}</strong><p>{{ block.policy.explanation }}</p></div></div>
    <div v-if="block.options?.length" class="options"><div v-for="option in block.options" :key="option.id" class="option"><div><el-tag v-if="option.recommended" type="success" size="small">推荐</el-tag><strong>{{ option.route }}</strong><p>{{ option.detail }} · {{ option.duration }}</p></div><div class="option-time">{{ option.departAt }}<br /><span>至 {{ option.arriveAt }}</span></div><strong v-if="option.price">{{ option.price }}</strong></div></div>
    <div v-if="block.action" class="confirmation"><div><strong>{{ block.action.title }}</strong><p>{{ block.action.summary }}</p><span class="action-status" role="status">{{ { pending: '请确认后执行', processing: '正在执行…', confirmed: '已确认执行', cancelled: '已取消', failed: '执行失败，请联系管理员确认结果' }[block.action.status] }}</span></div><div class="confirmation-actions"><el-button :disabled="block.action.status !== 'pending'" :loading="block.action.status === 'processing'" type="primary" :icon="Check" @click="emit('confirm', block.action)">确认执行</el-button><el-button :disabled="block.action.status !== 'pending'" :icon="Close" @click="emit('cancel', block.action)">取消</el-button></div></div>
  </div>
</template>

<style scoped>
.workflow-block { display: grid; gap: 12px; margin: 18px 0 28px; font-size: 13px; }
.policy, .confirmation { display: flex; align-items: flex-start; gap: 10px; padding: 16px; border: 1px solid #e8dcc3; border-radius: 8px; background: #fcfaf5; }
.policy.passed { border-color: #dde9e2; background: #f6faf8; color: #39755e; }
.policy > .el-icon { flex-shrink: 0; margin-top: 3px; }
.policy strong, .confirmation strong { font-weight: 500; }
.policy p, .confirmation p { margin: 5px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.8; }
.options { display: grid; gap: 8px; }
.option { display: flex; align-items: center; gap: 16px; justify-content: space-between; padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: white; }
.option strong { color: var(--text); font-weight: 500; }
.option p { margin: 5px 0 0; color: var(--text-muted); font-size: 12px; }
.option-time { text-align: center; color: var(--text); font-size: 13px; line-height: 1.7; }
.option-time span { color: var(--text-muted); font-size: 11px; }
.confirmation { align-items: center; justify-content: space-between; border-color: #dfe5f1; background: #f8faff; }
.action-status { display: block; margin-top: 8px; color: var(--text-muted); font-size: 11px; }
.confirmation-actions { display: flex; flex-shrink: 0; }
@media (max-width: 560px) { .option { align-items: flex-start; flex-wrap: wrap; } .confirmation { align-items: stretch; flex-direction: column; } }
</style>
