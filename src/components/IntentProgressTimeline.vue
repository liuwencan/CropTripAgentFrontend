<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, Check, Loading, Warning } from '@element-plus/icons-vue'
import type { IntentEvent, IntentProgressPayload } from '@/types/conversation'

const props = defineProps<{ events?: IntentEvent[]; connectToTools?: boolean }>()

type IntentStep = IntentProgressPayload & {
  key: string
  lifecycle?: 'start' | 'end'
}

const stageLabels: Record<string, string> = {
  structure_analysis: '结构分析',
  rule_matching: '规则匹配',
  semantic_retrieval: '语义检索',
  question_rewrite: '问题改写',
  llm_fallback: '模型兜底',
  recognition_result: '识别结果',
  recognition_fallback: '识别兜底',
}
const passLabels: Record<string, string> = { original: '原问题', rewritten: '改写问题' }
const collapsed = ref(false)

const steps = computed(() => {
  const result: IntentStep[] = []
  const byKey = new Map<string, IntentStep>()
  const events = [...(props.events ?? [])].sort((a, b) => a.sequence - b.sequence)
  for (const event of events) {
    if (event.type === 'intent_start') {
      result.push({ key: 'lifecycle-start', traceId: event.payload.traceId, stage: 'start', status: 'completed', message: '开始分析你的问题', lifecycle: 'start' })
      continue
    }
    if (event.type === 'intent_end') {
      result.push({ key: 'lifecycle-end', traceId: event.payload.traceId, stage: 'end', status: 'completed', message: '意图识别完成', lifecycle: 'end' })
      continue
    }
    const payload = event.payload
    const key = `${payload.stage}:${payload.pass ?? ''}`
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, payload)
    } else {
      const step = { key, ...payload }
      result.push(step)
      byKey.set(key, step)
    }
  }
  return result
})

const hasEnded = computed(() => props.events?.some((event) => event.type === 'intent_end') ?? false)
const isFailed = computed(() => steps.value.some((step) => ['failed', 'error'].includes(step.status)))
const isFinished = computed(() => hasEnded.value || isFailed.value || steps.value.some((step) => step.stage === 'recognition_result' && !['started', 'running', 'in_progress'].includes(step.status)))

watch(hasEnded, (ended) => {
  if (ended) collapsed.value = true
}, { immediate: true })

function toggleCollapsed() { collapsed.value = !collapsed.value }

function stageLabel(stage: string) { return stageLabels[stage] ?? stage }
function passLabel(pass?: string) { return pass ? (passLabels[pass] ?? pass) : '' }
function statusLabel(status: string) {
  if (['started', 'running', 'in_progress'].includes(status)) return '进行中'
  if (['failed', 'error'].includes(status)) return '识别失败'
  return '已完成'
}
function statusIcon(status: string) {
  if (['started', 'running', 'in_progress'].includes(status)) return Loading
  if (['failed', 'error'].includes(status)) return Warning
  return Check
}
function isResult(step: IntentStep) { return step.stage === 'recognition_result' && Boolean(step.intents || step.level || typeof step.isMultiIntent === 'boolean') }
</script>

<template>
  <section v-if="steps.length" class="intent-progress" :class="{ 'is-collapsed': collapsed, 'has-tool-connector': connectToTools }" aria-label="意图识别进度" aria-live="polite">
    <div class="intent-heading">
      <div class="intent-title"><span class="intent-pulse" :class="{ 'is-running': !isFinished, 'is-done': isFinished && !isFailed, 'is-failed': isFailed }"></span><strong>意图识别</strong><span class="intent-state">{{ isFinished ? (isFailed ? '识别失败' : '已完成') : '正在分析' }}</span></div>
      <button class="intent-toggle" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? '展开意图识别过程' : '折叠意图识别过程'" :title="collapsed ? '展开意图识别过程' : '折叠意图识别过程'" @click="toggleCollapsed">
        <el-icon :class="{ 'is-collapsed': collapsed }"><ArrowDown /></el-icon>
      </button>
    </div>
    <ol v-if="!collapsed" class="intent-steps">
      <li v-for="step in steps" :key="step.key" class="intent-step" :class="{ 'is-running': ['started', 'running', 'in_progress'].includes(step.status), 'is-failed': ['failed', 'error'].includes(step.status), 'is-result': isResult(step), 'is-lifecycle': step.lifecycle }">
        <span class="intent-node"><el-icon :class="{ 'is-loading': ['started', 'running', 'in_progress'].includes(step.status) }"><component :is="statusIcon(step.status)" /></el-icon></span>
        <div class="intent-step-body">
          <div class="intent-step-heading"><strong>{{ step.lifecycle ? step.message : stageLabel(step.stage) }}</strong><span v-if="passLabel(step.pass)" class="intent-pass">{{ passLabel(step.pass) }}</span><span class="intent-status">{{ statusLabel(step.status) }}</span></div>
          <p v-if="!step.lifecycle && step.message && step.message !== stageLabel(step.stage)">{{ step.message }}</p>
          <div v-if="step.stage === 'question_rewrite' && step.rewrittenQuestion" class="rewritten-question">
            <span class="rewritten-question-label">改写后问题</span>
            <p>{{ step.rewrittenQuestion }}</p>
          </div>
          <div v-if="isResult(step)" class="recognition-summary">
            <span v-if="step.level" class="recognition-level">{{ step.level }}</span>
            <span v-if="typeof step.isMultiIntent === 'boolean'" class="recognition-multi">{{ step.isMultiIntent ? '多意图' : '单一意图' }}</span>
            <span v-for="intent in step.intents ?? []" :key="intent" class="recognition-intent">{{ intent }}</span>
          </div>
        </div>
        <span v-if="step !== steps[steps.length - 1]" class="intent-connector" aria-hidden="true"></span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.intent-progress { position: relative; margin: 0 0 23px; color: var(--text); font-size: 12px; }
.intent-progress.has-tool-connector { margin-bottom: 0; }
.intent-progress.has-tool-connector::after { position: absolute; z-index: 0; top: 18px; bottom: calc(-1 * (var(--progress-connector-height, 22px) + 10px)); left: 3.5px; width: 1px; background: var(--line); content: ''; pointer-events: none; }
.intent-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.intent-progress.is-collapsed .intent-heading { margin-bottom: 0; }
.intent-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.intent-title strong { font-size: 12px; font-weight: 600; }
.intent-state { color: var(--text-muted); font-size: 11px; }
.intent-toggle { display: grid; width: 27px; height: 27px; flex: 0 0 27px; place-items: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; }
.intent-toggle:hover { background: #eef0f4; color: var(--text); }
.intent-toggle :deep(.el-icon) { transition: transform 160ms ease; }
.intent-toggle :deep(.el-icon.is-collapsed) { transform: rotate(-90deg); }
.intent-pulse { position: relative; z-index: 1; width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #c64c4c; box-shadow: 0 0 0 4px #f9eaea; animation: intent-pulse 1.8s ease-out infinite; }
.intent-pulse.is-done { background: var(--el-color-success); box-shadow: 0 0 0 4px var(--el-color-success-light-9); animation: none; }
.intent-pulse.is-failed { background: #a14b48; box-shadow: 0 0 0 4px #f7eaea; animation: none; }
.intent-steps { margin: 0; padding: 0; list-style: none; }
.intent-step { position: relative; display: flex; min-width: 0; padding: 0 0 14px 27px; }
.intent-step:last-child { padding-bottom: 0; }
.intent-node { position: absolute; top: 1px; left: 0; display: grid; width: 17px; height: 17px; place-items: center; background: var(--surface); color: #7b879a; font-size: 12px; z-index: 1; }
.intent-step.is-running .intent-node { color: var(--accent); }
.intent-step.is-failed .intent-node { color: #a14b48; }
.intent-step.is-result .intent-node { color: var(--el-color-success); }
.intent-step-body { min-width: 0; flex: 1; }
.intent-step-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; min-height: 18px; }
.intent-step-heading strong { overflow-wrap: anywhere; font-weight: 500; }
.intent-status { margin-left: auto; color: var(--text-muted); font-size: 11px; }
.intent-pass { padding: 1px 5px; border: 1px solid #dce3f0; border-radius: 3px; color: #687791; font-size: 10px; }
.intent-step p { margin: 4px 0 0; color: var(--text-muted); line-height: 1.55; overflow-wrap: anywhere; }
.rewritten-question { margin-top: 8px; padding: 9px 11px; border-left: 2px solid #b7c7eb; background: #f7f9fd; }
.rewritten-question-label { display: block; margin-bottom: 3px; color: #687791; font-size: 10px; }
.rewritten-question p { margin: 0; color: var(--text); line-height: 1.65; }
.intent-connector { position: absolute; top: 17px; bottom: 0; left: 8px; width: 1px; background: var(--line); }
.recognition-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.recognition-level, .recognition-multi, .recognition-intent { display: inline-flex; align-items: center; min-height: 21px; padding: 2px 7px; border-radius: 4px; font-size: 10px; line-height: 1.3; }
.recognition-level { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.recognition-multi { background: #f4f1e8; color: #88620a; }
.recognition-intent { background: #f5f7fa; color: #52617d; }
.is-loading { animation: progress-spin 1s linear infinite; }
@keyframes progress-spin { to { transform: rotate(360deg); } }
@keyframes intent-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .42; } }
@media (max-width: 720px) { .intent-heading { align-items: center; flex-direction: row; gap: 12px; }.intent-status { margin-left: 0; }.intent-step { padding-left: 24px; } }
@media (prefers-reduced-motion: reduce) { .is-loading, .intent-pulse { animation: none; } }
</style>
