<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, CircleCheck, CircleClose, Close, Connection, CopyDocument, Filter, Refresh, Search, Timer, WarningFilled } from '@element-plus/icons-vue'
import AdminPageShell from './AdminPageShell.vue'
import { traceApi } from '@/api/traceApi'
import type { AgentTraceDetail, AgentTraceQuery, AgentTraceSpan } from '@/types/admin'
import type { PageResponse } from '@/types/api'

interface TraceRow {
  traceId: string
  root: AgentTraceSpan
  spans: AgentTraceSpan[]
  status: string
  durationMs: number
  startTime: string
}

const query = reactive<AgentTraceQuery>({
  pageNo: 1,
  pageSize: 12,
  traceId: '',
  sessionId: '',
  userId: '',
  spanType: '',
  status: '',
  startFrom: '',
  startTo: '',
})
const result = ref<PageResponse<AgentTraceSpan>>({ success: true, data: [], pageNo: 1, pageSize: 12, totalCount: 0, totalPage: 0 })
const loading = ref(false)
const error = ref('')
const filterOpen = ref(true)
const selectedTraceId = ref('')
const selectedSpanId = ref('')
const traceModalOpen = ref(false)
const spanInspectorOpen = ref(false)
const detailSpans = ref<AgentTraceSpan[]>([])
const traceDetail = ref<AgentTraceDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const traceModalElement = ref<HTMLElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null
let previouslyFocusedSpanId = ''
let previousBodyOverflow = ''
let detailRequestId = 0

const traceRows = computed<TraceRow[]>(() => {
  const groups = new Map<string, AgentTraceSpan[]>()
  for (const span of result.value.data) groups.set(span.traceId, [...(groups.get(span.traceId) || []), span])
  return [...groups.entries()].map(([traceId, spans]) => {
    const sorted = [...spans].sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())
    const root = spans.find((span) => span.spanType === 'AGENT' && !span.parentSpanId) || sorted[0]
    const statuses = new Set(spans.map((span) => span.status))
    const status = statuses.has('FAILED') ? 'FAILED' : statuses.has('SUSPENDED') ? 'SUSPENDED' : statuses.has('RUNNING') ? 'RUNNING' : 'SUCCESS'
    return { traceId, root, spans, status, durationMs: durationForGroup(spans), startTime: sorted[0]?.startTime || '' }
  }).sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
})

const selectedTrace = computed(() => traceRows.value.find((row) => row.traceId === selectedTraceId.value))
const sortedDetailSpans = computed(() => [...detailSpans.value].sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()))
const selectedSpan = computed(() => detailSpans.value.find((span) => span.spanId === selectedSpanId.value) || sortedDetailSpans.value[0])
const totalInputTokens = computed(() => traceDetail.value?.totalInputTokens ?? sumTokens(detailSpans.value, 'inputTokens'))
const totalOutputTokens = computed(() => traceDetail.value?.totalOutputTokens ?? sumTokens(detailSpans.value, 'outputTokens'))

const statusLabels: Record<string, string> = { RUNNING: '进行中', SUCCESS: '成功', FAILED: '失败', SUSPENDED: '已挂起' }
const spanLabels: Record<string, string> = { AGENT: 'Agent', MODEL: '模型', TOOL: '工具', SUMMARY: '总结' }

function durationForSpan(span: AgentTraceSpan) {
  if (typeof span.durationMs === 'number') return span.durationMs
  if (!span.endTime) return 0
  return Math.max(0, new Date(span.endTime).getTime() - new Date(span.startTime).getTime())
}

function durationForGroup(spans: AgentTraceSpan[]) {
  const root = spans.find((span) => span.spanType === 'AGENT' && !span.parentSpanId)
  if (root) return durationForSpan(root)
  const starts = spans.map((span) => new Date(span.startTime).getTime()).filter(Number.isFinite)
  const ends = spans.map((span) => span.endTime ? new Date(span.endTime).getTime() : NaN).filter(Number.isFinite)
  return starts.length && ends.length ? Math.max(0, Math.max(...ends) - Math.min(...starts)) : Math.max(...spans.map(durationForSpan), 0)
}

function sumTokens(spans: AgentTraceSpan[], field: 'inputTokens' | 'outputTokens') {
  const values = spans.map((span) => span[field]).filter((value): value is number => typeof value === 'number')
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

function formatDuration(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} s`
}

function formatTokenCount(value?: number | null) {
  return value === null || value === undefined ? '—' : value.toLocaleString('zh-CN')
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function compactTrace(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function statusLabel(value?: string) { return statusLabels[value || ''] || value || '未知' }
function spanLabel(value?: string) { return spanLabels[value || ''] || value || '调用' }
function statusIcon(status: string) { return status === 'SUCCESS' ? CircleCheck : status === 'FAILED' ? CircleClose : status === 'SUSPENDED' ? WarningFilled : Timer }
function spanName(span: AgentTraceSpan) { return span.operationName || span.toolName || span.modelName || span.agentName || spanLabel(span.spanType) }
function spanMeta(span: AgentTraceSpan) {
  const primary = spanName(span)
  if (span.spanType === 'MODEL') {
    const modelName = span.modelName && span.modelName !== primary ? span.modelName : ''
    const iteration = span.iteration ? `第 ${span.iteration} 轮` : ''
    return [modelName, iteration].filter(Boolean).join(' · ')
  }
  if (span.spanType === 'TOOL') {
    if (span.toolName && span.toolName !== primary) return span.toolName
    return span.toolCallId && span.toolCallId !== primary ? `调用 ID ${span.toolCallId}` : ''
  }
  if (span.spanType === 'AGENT') {
    if (span.agentName && span.agentName !== primary) return span.agentName
    return span.agentId && span.agentId !== primary ? span.agentId : ''
  }
  return ''
}

function formatJson(value: unknown) {
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
  }
  try { return JSON.stringify(value, null, 2) ?? String(value) } catch { return String(value) }
}

function hasPayload(value: unknown) { return value !== null && value !== undefined && value !== '' }

function spanDepth(span: AgentTraceSpan) {
  const byId = new Map(detailSpans.value.map((item) => [item.spanId, item]))
  let depth = 0
  let parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined
  while (parent && depth < 5) {
    depth += 1
    parent = parent.parentSpanId ? byId.get(parent.parentSpanId) : undefined
  }
  return depth
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    result.value = await traceApi.query({ ...query })
    if (traceModalOpen.value && !traceRows.value.some((row) => row.traceId === selectedTraceId.value)) closeTraceModal()
    else if (traceModalOpen.value) await selectTrace(selectedTraceId.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '调用链路加载失败'
  } finally {
    loading.value = false
  }
}

async function selectTrace(traceId: string) {
  const requestId = ++detailRequestId
  if (!traceModalOpen.value) {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  selectedTraceId.value = traceId
  selectedSpanId.value = ''
  traceModalOpen.value = true
  spanInspectorOpen.value = false
  await nextTick()
  traceModalElement.value?.focus()
  detailError.value = ''
  const localSpans = result.value.data.filter((span) => span.traceId === traceId)
  detailSpans.value = localSpans
  traceDetail.value = { traceId, spans: localSpans }
  detailLoading.value = true
  try {
    const remoteDetail = await traceApi.detail(traceId)
    if (requestId !== detailRequestId) return
    if (remoteDetail?.spans?.length) {
      traceDetail.value = remoteDetail
      detailSpans.value = remoteDetail.spans
    }
  } catch (cause) {
    if (requestId !== detailRequestId) return
    detailError.value = cause instanceof Error ? cause.message : '链路详情加载失败，当前展示查询结果'
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

function openSpanInspector(spanId: string) {
  selectedSpanId.value = spanId
  previouslyFocusedSpanId = spanId
  spanInspectorOpen.value = true
}

function closeSpanInspector() {
  spanInspectorOpen.value = false
  nextTick(() => {
    const spanButton = [...(traceModalElement.value?.querySelectorAll<HTMLElement>('[data-span-id]') || [])]
      .find((element) => element.dataset.spanId === previouslyFocusedSpanId)
    spanButton?.focus()
  })
}

function closeTraceModal() {
  detailRequestId += 1
  spanInspectorOpen.value = false
  traceModalOpen.value = false
  selectedTraceId.value = ''
  selectedSpanId.value = ''
  detailSpans.value = []
  traceDetail.value = null
  detailError.value = ''
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => previouslyFocusedElement?.focus())
  previouslyFocusedElement = null
}

function handleKeydown(event: KeyboardEvent) {
  if (!traceModalOpen.value) return
  if (event.key === 'Escape') {
    if (spanInspectorOpen.value) closeSpanInspector()
    else closeTraceModal()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...(traceModalElement.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
  ) || [])].filter((element) => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === traceModalElement.value)) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function search() { query.pageNo = 1; load() }
function reset() {
  Object.assign(query, { traceId: '', sessionId: '', userId: '', spanType: '', status: '', startFrom: '', startTo: '' })
  search()
}

async function copyTraceId(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('Trace ID 已复制')
  } catch { ElMessage.warning('复制失败，请手动选择 Trace ID') }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <AdminPageShell title="智能体调用链路" description="从一次请求出发，定位 Agent、模型与工具的耗时、状态和失败原因。">
    <template #actions>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新数据</el-button>
    </template>

    <section class="trace-filter-panel" :class="{ collapsed: !filterOpen }">
      <div class="filter-heading"><h2>筛选条件</h2><button class="filter-toggle" :aria-expanded="filterOpen" @click="filterOpen = !filterOpen"><Filter /> {{ filterOpen ? '收起' : '展开' }}</button></div>
      <form v-show="filterOpen" class="trace-filters" @submit.prevent="search">
        <div class="filter-field filter-wide"><label for="trace-id">Trace ID</label><el-input id="trace-id" v-model="query.traceId" clearable placeholder="输入完整 Trace ID 精确查询" /></div>
        <div class="filter-field"><label for="session-id">会话 ID</label><el-input id="session-id" v-model="query.sessionId" clearable placeholder="例如 10482" /></div>
        <div class="filter-field"><label for="user-id">用户 ID</label><el-input id="user-id" v-model="query.userId" clearable placeholder="例如 208" /></div>
        <div class="filter-field"><label for="span-type">调用类型</label><el-select id="span-type" v-model="query.spanType" clearable placeholder="全部类型"><el-option label="Agent" value="AGENT" /><el-option label="模型" value="MODEL" /><el-option label="工具" value="TOOL" /><el-option label="总结" value="SUMMARY" /></el-select></div>
        <div class="filter-field"><label for="trace-status">状态</label><el-select id="trace-status" v-model="query.status" clearable placeholder="全部状态"><el-option label="进行中" value="RUNNING" /><el-option label="成功" value="SUCCESS" /><el-option label="失败" value="FAILED" /><el-option label="已挂起" value="SUSPENDED" /></el-select></div>
        <div class="filter-field"><label for="start-from">开始时间不早于</label><input id="start-from" v-model="query.startFrom" type="datetime-local" /></div>
        <div class="filter-field"><label for="start-to">开始时间不晚于</label><input id="start-to" v-model="query.startTo" type="datetime-local" /></div>
        <div class="filter-actions"><el-button type="primary" native-type="submit" :icon="Search" :loading="loading">查询链路</el-button><el-button :icon="Close" @click="reset">重置</el-button></div>
      </form>
    </section>

    <section class="trace-workspace" aria-label="调用链路记录">
      <div class="trace-list-panel">
        <div class="panel-heading"><h2>请求链路 <small>{{ traceRows.length }} 条 Trace</small></h2><span class="live-indicator">共 {{ result.totalCount }} 条 Span</span></div>
        <div v-if="error" class="trace-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
        <div v-else-if="!loading && !traceRows.length" class="trace-empty"><Connection /><strong>没有匹配的调用链路</strong><span>调整筛选条件后重新查询，或等待新的 Agent 请求进入。</span></div>
        <div v-else class="trace-list" :aria-busy="loading">
          <button v-for="row in traceRows" :key="row.traceId" class="trace-row" :class="{ selected: row.traceId === selectedTraceId }" @click="selectTrace(row.traceId)">
            <span class="trace-row-status" :class="`status-${row.status.toLowerCase()}`"><component :is="statusIcon(row.status)" /></span>
            <span class="trace-row-main"><strong>{{ row.root.agentName || row.root.operationName || '未命名 Agent' }}</strong><span><code>{{ compactTrace(row.traceId) }}</code><em>{{ row.spans.length }} spans</em></span></span>
            <span class="trace-row-type"><b>{{ statusLabel(row.status) }}</b><small>{{ spanLabel(row.root.spanType) }}</small></span>
            <span class="trace-row-duration"><strong>{{ formatDuration(row.durationMs) }}</strong><small>{{ formatTime(row.startTime) }}</small></span>
            <ArrowRight class="trace-row-arrow" />
          </button>
        </div>
        <el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" />
      </div>
    </section>

    <div v-if="traceModalOpen && selectedTrace" class="trace-modal-layer" role="presentation" @click.self="closeTraceModal">
      <section ref="traceModalElement" class="trace-modal" role="dialog" aria-modal="true" :aria-labelledby="spanInspectorOpen ? 'span-inspector-title' : 'trace-modal-title'" tabindex="-1">
        <header class="trace-modal-header"><div><span v-if="spanInspectorOpen" class="section-eyebrow">SPAN INSPECTOR</span><h2 v-if="spanInspectorOpen && selectedSpan" id="span-inspector-title">{{ spanName(selectedSpan) }}</h2><h2 v-else id="trace-modal-title">{{ selectedTrace.root.agentName || selectedTrace.root.operationName || 'Agent 请求' }}</h2><button v-if="!spanInspectorOpen" class="trace-id-copy" :title="selectedTrace.traceId" @click="copyTraceId(selectedTrace.traceId)"><code>{{ selectedTrace.traceId }}</code><el-icon class="trace-copy-icon"><CopyDocument /></el-icon></button></div><div class="modal-header-actions"><span v-if="spanInspectorOpen && selectedSpan" class="inspector-type">{{ spanLabel(selectedSpan.spanType) }}</span><span v-else class="status-pill" :class="`status-${selectedTrace.status.toLowerCase()}`"><component :is="statusIcon(selectedTrace.status)" />{{ statusLabel(selectedTrace.status) }}</span><button class="modal-close" :aria-label="spanInspectorOpen ? '关闭 Span 详情' : '关闭链路详情'" :title="spanInspectorOpen ? '关闭 Span 详情' : '关闭链路详情'" @click="spanInspectorOpen ? closeSpanInspector() : closeTraceModal()"><Close /></button></div></header>
        <div v-if="!spanInspectorOpen" class="detail-facts"><span><b>总耗时</b>{{ formatDuration(traceDetail?.totalDurationMs ?? selectedTrace.durationMs) }}</span><span><b>Span 数</b>{{ detailSpans.length }}</span><span><b>总输入 Token</b>{{ formatTokenCount(totalInputTokens) }}</span><span><b>总输出 Token</b>{{ formatTokenCount(totalOutputTokens) }}</span></div>
        <div v-if="detailError" class="detail-notice" role="status"><WarningFilled class="detail-notice-icon" /><span>{{ detailError }}</span></div>
        <div v-if="!spanInspectorOpen" class="trace-modal-body" :aria-busy="detailLoading">
          <div class="timeline-heading"><h3>调用时间线</h3><span>选择模型或工具调用查看详情</span></div>
          <div class="span-timeline">
            <button v-for="span in sortedDetailSpans" :key="span.spanId" :data-span-id="span.spanId" class="span-item" :class="{ active: span.spanId === selectedSpanId, failed: span.status === 'FAILED', actionable: ['MODEL', 'TOOL'].includes(span.spanType) }" :disabled="!['MODEL', 'TOOL'].includes(span.spanType)" :style="{ '--depth': spanDepth(span) }" @click="openSpanInspector(span.spanId)">
              <span class="span-rail"><i class="span-dot" :class="`dot-${span.status.toLowerCase()}`" /><i v-if="span !== sortedDetailSpans.at(-1)" class="span-line" /></span>
              <span class="span-content"><span class="span-topline"><b>{{ spanLabel(span.spanType) }}</b><small>{{ formatDuration(durationForSpan(span)) }}</small></span><strong>{{ spanName(span) }}</strong><span v-if="spanMeta(span)" class="span-subline">{{ spanMeta(span) }}</span></span><ArrowRight v-if="['MODEL', 'TOOL'].includes(span.spanType)" class="span-open-icon" />
            </button>
          </div>
        </div>
        <div v-else-if="selectedSpan" class="trace-modal-body inspector-body">
          <dl class="inspector-facts"><div><dt>Span ID</dt><dd><code>{{ selectedSpan.spanId }}</code></dd></div><div><dt>父 Span</dt><dd><code>{{ selectedSpan.parentSpanId || '根节点' }}</code></dd></div><div><dt>开始时间</dt><dd>{{ formatTime(selectedSpan.startTime) }}</dd></div><div><dt>持续时间</dt><dd>{{ formatDuration(durationForSpan(selectedSpan)) }}</dd></div><div><dt>输入 / 输出 Token</dt><dd>{{ selectedSpan.inputTokens ?? '—' }} / {{ selectedSpan.outputTokens ?? '—' }}</dd></div><div><dt>状态</dt><dd>{{ statusLabel(selectedSpan.status) }}</dd></div></dl>
          <div v-if="selectedSpan.errorSummary" class="inspector-error"><WarningFilled class="inspector-error-icon" /><span>{{ selectedSpan.errorSummary }}</span></div><details v-if="hasPayload(selectedSpan.inputMessages) || hasPayload(selectedSpan.outputMessage) || hasPayload(selectedSpan.toolResult) || hasPayload(selectedSpan.attributes)" class="payload-details" open><summary>调用数据 <small>内容可能包含业务信息</small></summary><section v-if="hasPayload(selectedSpan.inputMessages)"><h4>输入消息快照</h4><pre>{{ formatJson(selectedSpan.inputMessages) }}</pre></section><section v-if="hasPayload(selectedSpan.outputMessage)"><h4>输出消息</h4><pre>{{ formatJson(selectedSpan.outputMessage) }}</pre></section><section v-if="hasPayload(selectedSpan.toolResult)"><h4>工具执行结果</h4><pre>{{ formatJson(selectedSpan.toolResult) }}</pre></section><section v-if="hasPayload(selectedSpan.attributes)"><h4>扩展属性</h4><pre>{{ formatJson(selectedSpan.attributes) }}</pre></section></details>
        </div>
        <footer class="trace-modal-footer"><span v-if="spanInspectorOpen">{{ spanLabel(selectedSpan?.spanType) }} · {{ selectedTrace.traceId }}</span><span v-else><Connection /> {{ detailSpans.length }} 个 Span 按时间顺序排列</span><button v-if="spanInspectorOpen" class="text-button" @click="closeSpanInspector">返回调用时间线</button><button v-else class="text-button" @click="closeTraceModal">返回请求链路</button></footer>
      </section>
    </div>
  </AdminPageShell>
</template>

<style scoped>
.section-eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #5d75a8; font-size: 10px; font-weight: 650; letter-spacing: .12em; }
.trace-filter-panel { margin-bottom: 18px; padding: 18px 22px 20px; border: 1px solid var(--line); background: #fff; }.trace-filter-panel.collapsed { padding-bottom: 18px; }.filter-heading, .panel-heading, .detail-heading, .inspector-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }.filter-heading h2, .panel-heading h2, .detail-heading h2, .inspector-heading h3 { margin: 4px 0 0; color: var(--text); font-size: 15px; font-weight: 550; }.filter-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 5px 0; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; }.filter-toggle:hover { color: var(--accent); }.trace-filters { display: grid; grid-template-columns: minmax(180px, 1.5fr) repeat(4, minmax(120px, 1fr)) auto; gap: 14px 12px; align-items: end; margin-top: 18px; }.filter-field { min-width: 0; }.filter-field label { display: block; margin-bottom: 7px; color: #697386; font-size: 11px; }.filter-field :deep(.el-select), .filter-field input { width: 100%; }.filter-field input { height: 32px; padding: 0 10px; border: 1px solid var(--el-border-color); border-radius: 4px; outline: 0; color: var(--text); font: inherit; font-size: 12px; }.filter-field input:focus { border-color: var(--accent); }.filter-actions { display: flex; gap: 8px; white-space: nowrap; }.filter-actions :deep(.el-button + .el-button) { margin-left: 0; }
.trace-workspace { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 560px; border: 1px solid var(--line); background: #fff; }.trace-list-panel { min-width: 0; padding: 22px 22px 20px; }.panel-heading { margin-bottom: 18px; }.panel-heading h2 small { margin-left: 8px; color: #939cab; font-size: 11px; font-weight: 400; }.live-indicator { display: inline-flex; align-items: center; gap: 6px; color: #6f8a83; font-size: 11px; }.live-indicator i { width: 6px; height: 6px; border-radius: 50%; background: #65a087; box-shadow: 0 0 0 3px #65a0871c; }.trace-list { min-height: 420px; border-top: 1px solid var(--line); }.trace-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) 64px 104px 16px; gap: 12px; align-items: center; width: 100%; min-height: 78px; padding: 13px 6px; border: 0; border-bottom: 1px solid #eef0f4; background: transparent; color: inherit; text-align: left; cursor: pointer; }.trace-row:hover, .trace-row.selected { background: #f6f8fc; }.trace-row.selected { box-shadow: inset 3px 0 0 var(--accent); }.trace-row-status { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #edf1f7; color: #77869f; font-size: 14px; }.trace-row-status.status-success { background: #eaf5ef; color: #5a9677; }.trace-row-status.status-failed { background: #fbeeed; color: #b65c55; }.trace-row-status.status-suspended { background: #fbf3e3; color: #a77b35; }.trace-row-main, .trace-row-type, .trace-row-duration { display: flex; min-width: 0; flex-direction: column; gap: 6px; }.trace-row-main strong { overflow: hidden; color: var(--text); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.trace-row-main span { display: flex; align-items: center; gap: 8px; min-width: 0; }.trace-row-main code, .trace-id-copy code { overflow: hidden; color: #6d7890; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }.trace-row-main em { color: #9ca5b3; font-size: 10px; font-style: normal; }.trace-row-type b { color: #5c687d; font-size: 11px; font-weight: 500; }.trace-row-type small, .trace-row-duration small { color: #949dad; font-size: 10px; }.trace-row-duration { text-align: right; }.trace-row-duration strong { color: var(--text); font-size: 12px; font-weight: 500; }.trace-row-arrow { color: #b5bdc9; font-size: 15px; }.trace-list-panel :deep(.el-pagination) { justify-content: flex-end; margin-top: 18px; }.trace-error, .trace-empty { display: flex; min-height: 420px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--text-muted); font-size: 12px; text-align: center; }.trace-error { flex-direction: row; }.trace-empty .el-icon { color: #b4bfd0; font-size: 34px; }.trace-empty strong { color: #596477; font-weight: 500; }.trace-empty span { color: #9aa3b1; }
.trace-detail-panel { min-width: 0; padding: 22px 24px; background: #fbfcfe; }.detail-heading { align-items: flex-start; }.detail-heading h2 { max-width: 240px; overflow: hidden; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }.trace-id-copy { display: flex; align-items: center; gap: 6px; max-width: 245px; padding: 0; margin-top: 9px; border: 0; background: transparent; cursor: pointer; font-size: 11px; line-height: 1.2; }.trace-id-copy:hover code { color: var(--accent); }.trace-id-copy .trace-copy-icon { display: inline-flex; width: 14px; height: 14px; flex: 0 0 14px; align-items: center; justify-content: center; color: #92a0b4; font-size: 13px; }.trace-id-copy .trace-copy-icon :deep(svg) { width: 13px; height: 13px; }.status-pill { display: inline-flex; flex-shrink: 0; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 4px; color: #6d7890; background: #eef1f5; font-size: 11px; }.status-pill.status-success { color: #4b8a6c; background: #e8f4ed; }.status-pill.status-failed { color: #ae5d55; background: #fbedeb; }.status-pill.status-suspended { color: #997531; background: #fbf1df; }.detail-facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 18px 0; margin-top: 20px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }.detail-facts span { display: flex; flex-direction: column; gap: 5px; color: #5c687d; font-size: 12px; }.detail-facts b { color: #99a1ae; font-size: 10px; font-weight: 400; }.detail-notice { display: flex; align-items: center; gap: 6px; padding: 9px 10px; margin-top: 12px; color: #996f2b; background: #fff7e8; font-size: 11px; line-height: 1.5; }.span-timeline { padding: 17px 0 6px; }.span-item { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; width: 100%; min-height: 67px; padding: 0 0 0 calc(var(--depth) * 15px); border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }.span-rail { position: relative; display: flex; justify-content: center; }.span-dot { z-index: 1; width: 9px; height: 9px; margin-top: 4px; border: 2px solid #9ba8bc; border-radius: 50%; background: #fbfcfe; }.span-dot.dot-success { border-color: #69a487; background: #e8f4ed; }.span-dot.dot-failed { border-color: #c66b63; background: #fbedeb; }.span-dot.dot-running { border-color: #6288c7; background: #eaf0fb; }.span-line { position: absolute; top: 12px; bottom: -4px; width: 1px; background: #dfe4ec; }.span-content { display: flex; min-width: 0; flex-direction: column; gap: 4px; padding: 1px 10px 12px; border-left: 2px solid transparent; }.span-item:hover .span-content, .span-item.active .span-content { border-left-color: #aec0e5; background: #f1f4fa; }.span-item.failed .span-content { border-left-color: #e7b4af; }.span-topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.span-topline b { color: #61708a; font-size: 10px; font-weight: 600; letter-spacing: .08em; }.span-topline small { color: #8c96a7; font-size: 10px; }.span-content > strong { overflow: hidden; color: var(--text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.span-subline { overflow: hidden; color: #919aaa; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.span-subline em { margin-left: 8px; color: #718ac0; font-style: normal; }.span-inspector { padding: 16px; margin-top: 4px; border: 1px solid #e3e7ee; background: #fff; }.inspector-heading { align-items: flex-start; }.inspector-heading h3 { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.inspector-type { padding: 4px 6px; color: #637da9; background: #edf2fa; font-size: 10px; }.span-inspector dl { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 18px; margin: 16px 0 0; }.span-inspector dl div { min-width: 0; }.span-inspector dt { margin-bottom: 5px; color: #9aa3b1; font-size: 10px; }.span-inspector dd { overflow: hidden; margin: 0; color: #596477; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.span-inspector code { color: #67738a; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; }.inspector-error { display: flex; gap: 6px; padding: 9px 10px; margin-top: 14px; color: #a3564f; background: #fff1f0; font-size: 11px; line-height: 1.5; }.detail-empty { display: flex; height: 100%; min-height: 500px; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #9aa3b1; font-size: 12px; }.detail-empty .el-icon { color: #b8c3d3; font-size: 34px; }
.payload-details { margin-top: 14px; border-top: 1px solid #edf0f4; }.payload-details summary { padding: 12px 0 2px; color: #58677f; font-size: 11px; cursor: pointer; }.payload-details summary small { margin-left: 6px; color: #a0a8b4; font-size: 10px; }.payload-details h4 { margin: 12px 0 6px; color: #7c8799; font-size: 10px; font-weight: 500; }.payload-details pre { max-height: 240px; overflow: auto; padding: 10px; margin: 0; border: 1px solid #edf0f4; background: #f7f8fa; color: #4f5c70; font: 10px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.trace-modal-layer, .inspector-modal-layer { position: fixed; inset: 0; display: grid; place-items: center; padding: 28px; background: rgb(28 38 55 / 34%); backdrop-filter: blur(2px); }
.trace-modal-layer { z-index: 1200; }.inspector-modal-layer { z-index: 1210; background: rgb(28 38 55 / 48%); }
.trace-modal, .span-inspector-modal { display: flex; width: min(960px, 100%); max-height: min(820px, calc(100vh - 56px)); flex-direction: column; overflow: hidden; border: 1px solid #dce2eb; border-top: 3px solid #5375b4; border-radius: 7px; background: #fff; box-shadow: 0 24px 70px rgb(28 38 55 / 24%); outline: none; }
.trace-modal-header, .inspector-modal-header { display: flex; flex: 0 0 auto; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 22px 26px 18px; border-bottom: 1px solid #e9edf2; }.trace-modal-header h2, .inspector-modal-header h2 { max-width: min(640px, 70vw); overflow: hidden; margin: 5px 0 0; color: var(--text); font-size: 20px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
.modal-header-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 14px; }.modal-close { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; padding: 0; border: 1px solid #e5e9ef; border-radius: 5px; background: #fff; color: #667286; cursor: pointer; }.modal-close:hover { border-color: #cbd5e3; background: #f4f6f9; color: var(--text); }.trace-modal-header .trace-id-copy { max-width: min(520px, 70vw); }.trace-modal-header .trace-id-copy code { font-size: 11px; }
.trace-modal-body { min-height: 0; overflow: auto; padding: 18px 26px 10px; }.timeline-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }.timeline-heading h3 { margin: 4px 0 0; color: var(--text); font-size: 16px; font-weight: 550; }.timeline-heading > span { color: #8a95a6; font-size: 11px; }.span-timeline { padding: 16px 0 10px; }.span-item { grid-template-columns: 22px minmax(0, 1fr) 18px; align-items: stretch; min-height: 68px; padding-right: 10px; }.span-open-icon { align-self: center; color: #a1adbd; font-size: 14px; }.span-item:hover .span-open-icon { color: var(--accent); }.span-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.trace-modal-footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 26px; border-top: 1px solid #e9edf2; background: #fafbfd; }.trace-modal-footer > span { display: flex; align-items: center; gap: 7px; color: #8b95a5; font-size: 11px; }.trace-modal-footer .text-button { font-size: 12px; }
.span-inspector-modal { width: min(720px, 100%); max-height: min(760px, calc(100vh - 56px)); border-top-color: #4d8290; }.inspector-modal-header { padding-bottom: 16px; }.inspector-modal-header h2 { max-width: min(480px, 65vw); white-space: normal; overflow-wrap: anywhere; }.inspector-type { flex: 0 0 auto; padding: 5px 8px; color: #4e7784; background: #e9f2f3; font-size: 11px; }.span-inspector-modal > dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 24px; padding: 20px 26px; margin: 0; border-bottom: 1px solid #edf0f4; }.span-inspector-modal > dl div { min-width: 0; }.span-inspector-modal dt { margin-bottom: 6px; color: #929cab; font-size: 10px; }.span-inspector-modal dd { overflow: hidden; margin: 0; color: #4f5d72; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.span-inspector-modal dd code { color: #61728b; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; }.span-inspector-modal .inspector-error, .span-inspector-modal .payload-details { margin-right: 26px; margin-left: 26px; }.span-inspector-modal .inspector-error { flex: 0 0 auto; }.span-inspector-modal .payload-details { min-height: 0; overflow: auto; padding-bottom: 22px; }
@media (max-width: 1180px) { .trace-filters { grid-template-columns: repeat(3, 1fr); }.filter-wide { grid-column: span 2; }.filter-actions { justify-content: flex-end; } }
@media (max-width: 900px) { .dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.dashboard-metric:nth-child(2) { border-right: 0; }.dashboard-metric:nth-child(n + 3) { border-top: 1px solid #edf0f4; }.dashboard-metric:nth-child(3) { padding-left: 4px; } }
@media (max-width: 720px) { .trace-dashboard { padding: 12px 14px; }.dashboard-metric { gap: 9px; padding: 9px 10px; }.dashboard-metric:first-child { padding-left: 0; }.dashboard-metric:nth-child(3) { padding-left: 0; }.metric-copy strong { font-size: 17px; }.trace-filter-panel, .trace-list-panel { padding-left: 16px; padding-right: 16px; }.trace-filters { grid-template-columns: 1fr 1fr; }.filter-wide { grid-column: span 2; }.filter-actions { grid-column: span 2; justify-content: flex-start; }.trace-row { grid-template-columns: 24px minmax(0, 1fr) 16px; gap: 8px; }.trace-row-type, .trace-row-duration { display: none; }.detail-facts { grid-template-columns: repeat(2, 1fr); }.trace-modal-layer, .inspector-modal-layer { padding: 12px; }.trace-modal, .span-inspector-modal { max-height: calc(100vh - 24px); }.trace-modal-header, .inspector-modal-header, .trace-modal-body { padding-right: 18px; padding-left: 18px; }.trace-modal-footer { padding-right: 18px; padding-left: 18px; }.span-inspector-modal > dl { padding-right: 18px; padding-left: 18px; }.span-inspector-modal .inspector-error, .span-inspector-modal .payload-details { margin-right: 18px; margin-left: 18px; } }
@media (max-width: 430px) { .dashboard-heading { align-items: flex-start; flex-direction: column; gap: 7px; }.dashboard-metrics { grid-template-columns: 1fr; }.dashboard-metric, .dashboard-metric:nth-child(2), .dashboard-metric:nth-child(n + 3) { min-height: 60px; padding: 7px 0; border-top: 1px solid #edf0f4; border-right: 0; }.dashboard-metric:first-child { border-top: 0; }.trace-filters { grid-template-columns: 1fr; }.filter-wide, .filter-actions { grid-column: auto; }.trace-row-main strong { max-width: 180px; }.panel-heading { align-items: flex-start; flex-direction: column; gap: 8px; }.trace-modal-header, .inspector-modal-header { gap: 8px; padding: 16px 14px 14px; }.trace-modal-header h2, .inspector-modal-header h2 { max-width: 56vw; font-size: 17px; }.trace-modal-header .status-pill { display: none; }.trace-modal-header .trace-id-copy { max-width: 56vw; }.trace-modal-body { padding: 15px 14px 8px; }.timeline-heading { align-items: flex-start; flex-direction: column; gap: 6px; }.trace-modal-footer { padding: 12px 14px; }.trace-modal-footer > span { font-size: 10px; }.span-inspector-modal > dl { grid-template-columns: 1fr; gap: 13px; padding: 16px 14px; }.span-inspector-modal .inspector-error, .span-inspector-modal .payload-details { margin-right: 14px; margin-left: 14px; } }

.trace-modal-layer { z-index: 1200; overflow-y: auto; overscroll-behavior: contain; padding: max(20px, 3vh) 24px; background: rgb(28 38 55 / 32%); backdrop-filter: none; }
.trace-modal { width: min(960px, 100%); height: min(820px, calc(100vh - 40px)); max-height: calc(100vh - 40px); min-height: 0; border: 1px solid #dce2eb; border-radius: 4px; border-top: 2px solid #657b9b; box-shadow: 0 14px 38px rgb(28 38 55 / 18%); }
.trace-modal-header { align-items: flex-start; padding: 18px 24px 15px; }
.detail-facts { flex: 0 0 auto; margin: 0 24px; padding: 14px 0; }
.trace-modal-body { display: block; flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 18px 24px 20px; }
.trace-modal-footer { flex: 0 0 auto; }
.inspector-body { padding-top: 20px; }
.inspector-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 24px; padding: 0 0 20px; margin: 0; border-bottom: 1px solid #edf0f4; }
.inspector-facts div { min-width: 0; }
.inspector-facts dt { margin-bottom: 6px; color: #778294; font-size: 11px; }
.inspector-facts dd { overflow: hidden; margin: 0; color: #344054; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.inspector-facts dd code { color: #53647b; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.inspector-error { align-items: flex-start; }
.inspector-error-icon, .detail-notice-icon { width: 16px; height: 16px; flex: 0 0 16px; font-size: 16px; }
.detail-notice { align-items: flex-start; }
.trace-modal :deep(svg) { max-width: 1em; max-height: 1em; }
.trace-modal :deep(.el-icon) { width: 1em; height: 1em; flex: 0 0 1em; }
.trace-modal :deep(.el-icon svg) { width: 100%; height: 100%; }
.trace-modal :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 720px) {
  .trace-modal-layer { align-items: start; padding: 12px; }
  .trace-modal { height: calc(100dvh - 24px); max-height: calc(100dvh - 24px); }
  .trace-modal-header { padding: 16px 18px 14px; }
  .detail-facts { margin-right: 18px; margin-left: 18px; }
  .trace-modal-body { padding: 15px 18px 18px; }
  .trace-modal-footer { padding: 12px 18px; }
}
@media (max-width: 430px) {
  .trace-modal { width: 100%; border-radius: 3px; }
  .inspector-facts { grid-template-columns: 1fr; gap: 13px; }
  .trace-modal-footer { align-items: flex-start; }
}

.trace-filter-panel,
.trace-workspace {
  border-color: #dfe3e8;
  border-radius: 3px;
  box-shadow: none;
}
.filter-heading h2,
.panel-heading h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.trace-list-panel { padding: 18px 20px 20px; }
.panel-heading { margin-bottom: 14px; }
.panel-heading h2 small { font-variant-numeric: tabular-nums; }
.live-indicator { color: #737d8c; font-variant-numeric: tabular-nums; }
.trace-row { min-height: 70px; border-bottom-color: #edf0f2; }
.trace-row:hover,
.trace-row.selected { background: #f7f8fa; }
.trace-row.selected { box-shadow: inset 2px 0 0 #61748e; }
.trace-row-status { border-radius: 3px; }
.trace-row-main code,
.trace-id-copy code,
.inspector-facts code { font-variant-numeric: tabular-nums; }
.trace-modal-layer {
  background: rgb(22 29 38 / 42%);
  backdrop-filter: none;
}
.trace-modal {
  border-color: #d9dde3;
  border-top: 2px solid #69788c;
  border-radius: 4px;
  box-shadow: 0 12px 32px rgb(20 28 38 / 20%);
}
.trace-modal-header {
  align-items: center;
  border-bottom-color: #e5e8ec;
}
.trace-modal-header h2 {
  font-size: 18px;
  font-weight: 600;
}
.trace-modal :deep(svg) {
  width: 1em !important;
  height: 1em !important;
  max-width: 1em !important;
  max-height: 1em !important;
}
.trace-modal .detail-notice-icon,
.trace-modal .inspector-error-icon {
  display: block;
  width: 16px !important;
  height: 16px !important;
  min-width: 16px;
  min-height: 16px;
  max-width: 16px !important;
  max-height: 16px !important;
  flex: 0 0 16px;
  font-size: 16px;
}
.trace-modal-body { scrollbar-color: #c5cbd3 transparent; scrollbar-width: thin; }
.span-content { border-left-width: 1px; }
.span-item.actionable { cursor: pointer; }
.span-item:disabled { cursor: default; }
.span-item:hover .span-content,
.span-item.active .span-content,
.span-item.actionable:hover .span-content { border-left-color: #8695a8; background: #f5f6f8; }
.trace-modal-footer { background: #fafbfc; }
.trace-modal :focus-visible { outline-offset: 2px; }

@media (max-width: 720px) {
  .trace-list-panel { padding: 16px; }
  .trace-row { min-height: 64px; }
  .trace-modal-header { align-items: flex-start; }
}
</style>
