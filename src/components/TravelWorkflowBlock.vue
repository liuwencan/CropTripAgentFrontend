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
    <div v-if="block.action" class="confirmation"><div><strong>{{ block.action.title }}</strong><p>{{ block.action.summary }}</p></div><div class="confirmation-actions"><el-button :disabled="block.action.status !== 'pending'" type="primary" :icon="Check" @click="emit('confirm', block.action)">确认执行</el-button><el-button :disabled="block.action.status !== 'pending'" :icon="Close" @click="emit('cancel', block.action)">取消</el-button></div></div>
  </div>
</template>

<style scoped>
.workflow-block { margin: 12px 0; }
.policy, .confirmation { display: flex; align-items: flex-start; gap: 10px; padding: 13px; border: 1px solid #efcf9b; border-radius: 9px; background: #fff9ed; }
.policy.passed { border-color: #b9e2d1; background: #effaf5; color: #18725d; }
.policy p, .confirmation p { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
.options { display: grid; gap: 8px; }
.option { display: flex; align-items: center; gap: 16px; justify-content: space-between; padding: 12px; border: 1px solid #dfe9e6; border-radius: 8px; background: #fbfdfc; }
.option strong { color: #204a43; }
.option p { margin: 5px 0 0; color: #75847f; font-size: 12px; }
.option-time { text-align: center; color: #305c53; font-size: 13px; line-height: 1.7; }
.option-time span { color: #87938f; font-size: 11px; }
.confirmation { align-items: center; justify-content: space-between; border-color: #b9d6ec; background: #f0f7fd; }
.confirmation-actions { display: flex; flex-shrink: 0; }
@media (max-width: 560px) { .option { align-items: flex-start; flex-wrap: wrap; } .confirmation { align-items: stretch; flex-direction: column; } }
</style>
