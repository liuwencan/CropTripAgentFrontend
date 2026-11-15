<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
const detailSpans = ref<AgentTraceSpan[]>([])
const traceDetail = ref<AgentTraceDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
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
const totalRequests = computed(() => traceRows.value.length)
const successRateValue = computed(() => totalRequests.value ? Math.round(traceRows.value.filter((row) => row.status === 'SUCCESS').length / totalRequests.value * 100) : null)
const successRate = computed(() => successRateValue.value === null ? '—' : `${successRateValue.value}%`)
const p95Duration = computed(() => {
  const durations = traceRows.value.map((row) => row.durationMs).sort((left, right) => left - right)
  if (!durations.length) return '—'
  return formatDuration(durations[Math.min(durations.length - 1, Math.ceil(durations.length * .95) - 1)])
})
const failedTools = computed(() => result.value.data.filter((span) => span.spanType === 'TOOL' && span.status === 'FAILED').length)

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
    const first = traceRows.value[0]
    if (!first) {
      selectedTraceId.value = ''
      detailSpans.value = []
      traceDetail.value = null
    } else if (!traceRows.value.some((row) => row.traceId === selectedTraceId.value)) {
      await selectTrace(first.traceId)
    } else {
      await selectTrace(selectedTraceId.value)
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '调用链路加载失败'
  } finally {
    loading.value = false
  }
}

async function selectTrace(traceId: string) {
  const requestId = ++detailRequestId
  selectedTraceId.value = traceId
  selectedSpanId.value = ''
  detailError.value = ''
  const localSpans = result.value.data.filter((span) => span.traceId === traceId)
  detailSpans.value = localSpans
  traceDetail.value = { traceId, spans: localSpans }
  selectedSpanId.value = (localSpans.find((span) => span.spanType === 'AGENT') || localSpans[0])?.spanId || ''
  detailLoading.value = true
  try {
    const remoteDetail = await traceApi.detail(traceId)
    if (requestId !== detailRequestId) return
    if (remoteDetail?.spans?.length) {
      traceDetail.value = remoteDetail
      detailSpans.value = remoteDetail.spans
      selectedSpanId.value = (remoteDetail.spans.find((span) => span.spanId === selectedSpanId.value) || remoteDetail.spans.find((span) => span.spanType === 'AGENT') || remoteDetail.spans[0])?.spanId || ''
    }
  } catch (cause) {
    if (requestId !== detailRequestId) return
    detailError.value = cause instanceof Error ? cause.message : '链路详情加载失败，当前展示查询结果'
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
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

onMounted(load)
</script>

<template>
  <AdminPageShell title="智能体调用链路" description="从一次请求出发，定位 Agent、模型与工具的耗时、状态和失败原因。">
    <template #actions>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新数据</el-button>
    </template>

    <section class="trace-dashboard" aria-label="链路运行仪表盘">
      <header class="dashboard-heading"><div><span class="dashboard-kicker"><Connection /> 运行概览</span><h2>链路健康度</h2></div><span class="dashboard-period">第 {{ result.pageNo || 1 }} 页 <i /> {{ result.totalCount }} 条 Span</span></header>
      <div class="dashboard-metrics">
        <div class="dashboard-metric request-metric"><span class="metric-icon request-icon"><el-icon><Connection /></el-icon></span><div class="metric-copy"><span class="metric-label">请求链路</span><strong>{{ totalRequests }}</strong><small>当前页去重 Trace</small></div></div>
        <div class="dashboard-metric success-metric"><div class="success-gauge" :class="{ empty: successRateValue === null }" :style="{ '--rate': `${successRateValue || 0}%` }"><span>{{ successRate }}</span></div><div class="metric-copy"><span class="metric-label">成功率</span><strong>{{ successRate }}</strong><small>当前页成功链路占比</small></div></div>
        <div class="dashboard-metric latency-metric"><span class="metric-icon latency-icon"><el-icon><Timer /></el-icon></span><div class="metric-copy"><span class="metric-label">P95 耗时</span><strong>{{ p95Duration }}</strong><small>当前页链路总时长</small></div></div>
        <div class="dashboard-metric failure-metric"><span class="metric-icon failure-icon"><el-icon><WarningFilled /></el-icon></span><div class="metric-copy"><span class="metric-label">失败工具</span><strong>{{ failedTools }}</strong><small>当前页失败的工具 Span</small></div></div>
      </div>
    </section>

    <section class="trace-filter-panel" :class="{ collapsed: !filterOpen }">
      <div class="filter-heading"><div><span class="section-eyebrow">QUERY</span><h2>筛选调用记录</h2></div><button class="filter-toggle" :aria-expanded="filterOpen" @click="filterOpen = !filterOpen"><Filter /> {{ filterOpen ? '收起筛选' : '展开筛选' }}</button></div>
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
        <div class="panel-heading"><div><span class="section-eyebrow">TRACE STREAM</span><h2>请求链路 <small>{{ result.totalCount }} 条 Span</small></h2></div><span class="live-indicator"><i />查询结果</span></div>
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

      <aside class="trace-detail-panel" aria-label="选中链路详情">
        <div v-if="!selectedTrace" class="detail-empty"><Connection /><span>选择一条链路查看详情</span></div>
        <template v-else>
          <div class="detail-heading"><div><span class="section-eyebrow">一轮对话完整链路</span><h2>{{ selectedTrace.root.agentName || selectedTrace.root.operationName || 'Agent 请求' }}</h2><button class="trace-id-copy" :title="selectedTrace.traceId" @click="copyTraceId(selectedTrace.traceId)"><code>{{ selectedTrace.traceId }}</code><el-icon class="trace-copy-icon"><CopyDocument /></el-icon></button></div><span class="status-pill" :class="`status-${selectedTrace.status.toLowerCase()}`"><component :is="statusIcon(selectedTrace.status)" />{{ statusLabel(selectedTrace.status) }}</span></div>
          <div class="detail-facts"><span><b>总耗时</b>{{ formatDuration(traceDetail?.totalDurationMs ?? selectedTrace.durationMs) }}</span><span><b>Span 数</b>{{ detailSpans.length }}</span><span><b>总输入 Token</b>{{ formatTokenCount(totalInputTokens) }}</span><span><b>总输出 Token</b>{{ formatTokenCount(totalOutputTokens) }}</span></div>
          <div v-if="detailError" class="detail-notice"><WarningFilled />{{ detailError }}</div>
          <div class="span-timeline" :aria-busy="detailLoading">
            <button v-for="span in sortedDetailSpans" :key="span.spanId" class="span-item" :class="{ active: span.spanId === selectedSpanId, failed: span.status === 'FAILED' }" :style="{ '--depth': spanDepth(span) }" @click="selectedSpanId = span.spanId">
              <span class="span-rail"><i class="span-dot" :class="`dot-${span.status.toLowerCase()}`" /><i v-if="span !== sortedDetailSpans.at(-1)" class="span-line" /></span>
              <span class="span-content"><span class="span-topline"><b>{{ spanLabel(span.spanType) }}</b><small>{{ formatDuration(durationForSpan(span)) }}</small></span><strong>{{ spanName(span) }}</strong><span v-if="spanMeta(span)" class="span-subline">{{ spanMeta(span) }}</span></span>
            </button>
          </div>
          <div v-if="selectedSpan" class="span-inspector"><div class="inspector-heading"><div><span class="section-eyebrow">SPAN INSPECTOR</span><h3>{{ spanName(selectedSpan) }}</h3></div><span class="inspector-type">{{ spanLabel(selectedSpan.spanType) }}</span></div><dl><div><dt>Span ID</dt><dd><code>{{ selectedSpan.spanId }}</code></dd></div><div><dt>父 Span</dt><dd><code>{{ selectedSpan.parentSpanId || '根节点' }}</code></dd></div><div><dt>开始时间</dt><dd>{{ formatTime(selectedSpan.startTime) }}</dd></div><div><dt>输入 / 输出 Token</dt><dd>{{ selectedSpan.inputTokens ?? '—' }} / {{ selectedSpan.outputTokens ?? '—' }}</dd></div></dl><div v-if="selectedSpan.errorSummary" class="inspector-error"><WarningFilled /><span>{{ selectedSpan.errorSummary }}</span></div><details v-if="hasPayload(selectedSpan.inputMessages) || hasPayload(selectedSpan.outputMessage) || hasPayload(selectedSpan.toolResult) || hasPayload(selectedSpan.attributes)" class="payload-details"><summary>查看调用数据 <small>内容可能包含业务信息</small></summary><section v-if="hasPayload(selectedSpan.inputMessages)"><h4>输入消息快照</h4><pre>{{ formatJson(selectedSpan.inputMessages) }}</pre></section><section v-if="hasPayload(selectedSpan.outputMessage)"><h4>输出消息</h4><pre>{{ formatJson(selectedSpan.outputMessage) }}</pre></section><section v-if="hasPayload(selectedSpan.toolResult)"><h4>工具执行结果</h4><pre>{{ formatJson(selectedSpan.toolResult) }}</pre></section><section v-if="hasPayload(selectedSpan.attributes)"><h4>扩展属性</h4><pre>{{ formatJson(selectedSpan.attributes) }}</pre></section></details></div>
        </template>
      </aside>
    </section>
  </AdminPageShell>
</template>

<style scoped>
.trace-dashboard { margin-bottom: 16px; padding: 13px 20px 14px; border: 1px solid var(--line); background: #fff; }
.dashboard-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 11px; border-bottom: 1px solid #edf0f4; }.dashboard-kicker { display: inline-flex; align-items: center; gap: 6px; color: #60769f; font-size: 10px; font-weight: 550; }.dashboard-kicker svg { width: 13px; height: 13px; }.dashboard-heading h2 { margin: 3px 0 0; color: var(--text); font-size: 15px; font-weight: 550; }.dashboard-period { display: inline-flex; align-items: center; gap: 8px; color: #8b95a5; font-size: 10px; white-space: nowrap; }.dashboard-period i { width: 3px; height: 3px; border-radius: 50%; background: #b6beca; }
.dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }.dashboard-metric { display: flex; min-width: 0; min-height: 68px; align-items: center; gap: 12px; padding: 9px 18px; border-right: 1px solid #edf0f4; }.dashboard-metric:first-child { padding-left: 4px; }.dashboard-metric:last-child { padding-right: 4px; border-right: 0; }.metric-icon { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 50%; font-size: 15px; }.request-icon { color: #5975a8; background: #edf2fa; }.latency-icon { color: #9b8045; background: #f7f2e7; }.failure-icon { color: #af625b; background: #faeeee; }.metric-copy { display: flex; min-width: 0; flex-direction: column; gap: 1px; }.metric-label { color: #7d8797; font-size: 10px; }.metric-copy strong { overflow: hidden; color: #303c50; font-size: 19px; font-weight: 550; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }.metric-copy small { overflow: hidden; color: #9ba4b1; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.failure-metric .metric-copy strong { color: #af625b; }.success-gauge { position: relative; display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border-radius: 50%; background: conic-gradient(#4b9a79 var(--rate), #e8edf1 0); }.success-gauge::before { position: absolute; inset: 4px; border-radius: 50%; background: #fff; content: ''; }.success-gauge span { position: relative; color: #438565; font-size: 10px; font-weight: 650; }.success-gauge.empty span { color: #929cab; }.success-metric .metric-copy strong { display: none; }
.section-eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #5d75a8; font-size: 10px; font-weight: 650; letter-spacing: .12em; }
.trace-filter-panel { margin-bottom: 18px; padding: 18px 22px 20px; border: 1px solid var(--line); background: #fff; }.trace-filter-panel.collapsed { padding-bottom: 18px; }.filter-heading, .panel-heading, .detail-heading, .inspector-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }.filter-heading h2, .panel-heading h2, .detail-heading h2, .inspector-heading h3 { margin: 4px 0 0; color: var(--text); font-size: 15px; font-weight: 550; }.filter-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 5px 0; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; }.filter-toggle:hover { color: var(--accent); }.trace-filters { display: grid; grid-template-columns: minmax(180px, 1.5fr) repeat(4, minmax(120px, 1fr)) auto; gap: 14px 12px; align-items: end; margin-top: 18px; }.filter-field { min-width: 0; }.filter-field label { display: block; margin-bottom: 7px; color: #697386; font-size: 11px; }.filter-field :deep(.el-select), .filter-field input { width: 100%; }.filter-field input { height: 32px; padding: 0 10px; border: 1px solid var(--el-border-color); border-radius: 4px; outline: 0; color: var(--text); font: inherit; font-size: 12px; }.filter-field input:focus { border-color: var(--accent); }.filter-actions { display: flex; gap: 8px; white-space: nowrap; }.filter-actions :deep(.el-button + .el-button) { margin-left: 0; }
.trace-workspace { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(360px, .88fr); min-height: 560px; border: 1px solid var(--line); background: #fff; }.trace-list-panel { min-width: 0; padding: 22px 22px 20px; border-right: 1px solid var(--line); }.panel-heading { margin-bottom: 18px; }.panel-heading h2 small { margin-left: 8px; color: #939cab; font-size: 11px; font-weight: 400; }.live-indicator { display: inline-flex; align-items: center; gap: 6px; color: #6f8a83; font-size: 11px; }.live-indicator i { width: 6px; height: 6px; border-radius: 50%; background: #65a087; box-shadow: 0 0 0 3px #65a0871c; }.trace-list { min-height: 420px; border-top: 1px solid var(--line); }.trace-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) 64px 104px 16px; gap: 12px; align-items: center; width: 100%; min-height: 78px; padding: 13px 6px; border: 0; border-bottom: 1px solid #eef0f4; background: transparent; color: inherit; text-align: left; cursor: pointer; }.trace-row:hover, .trace-row.selected { background: #f6f8fc; }.trace-row.selected { box-shadow: inset 3px 0 0 var(--accent); }.trace-row-status { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #edf1f7; color: #77869f; font-size: 14px; }.trace-row-status.status-success { background: #eaf5ef; color: #5a9677; }.trace-row-status.status-failed { background: #fbeeed; color: #b65c55; }.trace-row-status.status-suspended { background: #fbf3e3; color: #a77b35; }.trace-row-main, .trace-row-type, .trace-row-duration { display: flex; min-width: 0; flex-direction: column; gap: 6px; }.trace-row-main strong { overflow: hidden; color: var(--text); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.trace-row-main span { display: flex; align-items: center; gap: 8px; min-width: 0; }.trace-row-main code, .trace-id-copy code { overflow: hidden; color: #6d7890; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }.trace-row-main em { color: #9ca5b3; font-size: 10px; font-style: normal; }.trace-row-type b { color: #5c687d; font-size: 11px; font-weight: 500; }.trace-row-type small, .trace-row-duration small { color: #949dad; font-size: 10px; }.trace-row-duration { text-align: right; }.trace-row-duration strong { color: var(--text); font-size: 12px; font-weight: 500; }.trace-row-arrow { color: #b5bdc9; font-size: 15px; }.trace-list-panel :deep(.el-pagination) { justify-content: flex-end; margin-top: 18px; }.trace-error, .trace-empty { display: flex; min-height: 420px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--text-muted); font-size: 12px; text-align: center; }.trace-error { flex-direction: row; }.trace-empty .el-icon { color: #b4bfd0; font-size: 34px; }.trace-empty strong { color: #596477; font-weight: 500; }.trace-empty span { color: #9aa3b1; }
.trace-detail-panel { min-width: 0; padding: 22px 24px; background: #fbfcfe; }.detail-heading { align-items: flex-start; }.detail-heading h2 { max-width: 240px; overflow: hidden; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }.trace-id-copy { display: flex; align-items: center; gap: 6px; max-width: 245px; padding: 0; margin-top: 9px; border: 0; background: transparent; cursor: pointer; font-size: 11px; line-height: 1.2; }.trace-id-copy:hover code { color: var(--accent); }.trace-id-copy .trace-copy-icon { display: inline-flex; width: 14px; height: 14px; flex: 0 0 14px; align-items: center; justify-content: center; color: #92a0b4; font-size: 13px; }.trace-id-copy .trace-copy-icon :deep(svg) { width: 13px; height: 13px; }.status-pill { display: inline-flex; flex-shrink: 0; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 4px; color: #6d7890; background: #eef1f5; font-size: 11px; }.status-pill.status-success { color: #4b8a6c; background: #e8f4ed; }.status-pill.status-failed { color: #ae5d55; background: #fbedeb; }.status-pill.status-suspended { color: #997531; background: #fbf1df; }.detail-facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 18px 0; margin-top: 20px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }.detail-facts span { display: flex; flex-direction: column; gap: 5px; color: #5c687d; font-size: 12px; }.detail-facts b { color: #99a1ae; font-size: 10px; font-weight: 400; }.detail-notice { display: flex; align-items: center; gap: 6px; padding: 9px 10px; margin-top: 12px; color: #996f2b; background: #fff7e8; font-size: 11px; line-height: 1.5; }.span-timeline { padding: 17px 0 6px; }.span-item { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; width: 100%; min-height: 67px; padding: 0 0 0 calc(var(--depth) * 15px); border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }.span-rail { position: relative; display: flex; justify-content: center; }.span-dot { z-index: 1; width: 9px; height: 9px; margin-top: 4px; border: 2px solid #9ba8bc; border-radius: 50%; background: #fbfcfe; }.span-dot.dot-success { border-color: #69a487; background: #e8f4ed; }.span-dot.dot-failed { border-color: #c66b63; background: #fbedeb; }.span-dot.dot-running { border-color: #6288c7; background: #eaf0fb; }.span-line { position: absolute; top: 12px; bottom: -4px; width: 1px; background: #dfe4ec; }.span-content { display: flex; min-width: 0; flex-direction: column; gap: 4px; padding: 1px 10px 12px; border-left: 2px solid transparent; }.span-item:hover .span-content, .span-item.active .span-content { border-left-color: #aec0e5; background: #f1f4fa; }.span-item.failed .span-content { border-left-color: #e7b4af; }.span-topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.span-topline b { color: #61708a; font-size: 10px; font-weight: 600; letter-spacing: .08em; }.span-topline small { color: #8c96a7; font-size: 10px; }.span-content > strong { overflow: hidden; color: var(--text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.span-subline { overflow: hidden; color: #919aaa; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.span-subline em { margin-left: 8px; color: #718ac0; font-style: normal; }.span-inspector { padding: 16px; margin-top: 4px; border: 1px solid #e3e7ee; background: #fff; }.inspector-heading { align-items: flex-start; }.inspector-heading h3 { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.inspector-type { padding: 4px 6px; color: #637da9; background: #edf2fa; font-size: 10px; }.span-inspector dl { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 18px; margin: 16px 0 0; }.span-inspector dl div { min-width: 0; }.span-inspector dt { margin-bottom: 5px; color: #9aa3b1; font-size: 10px; }.span-inspector dd { overflow: hidden; margin: 0; color: #596477; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.span-inspector code { color: #67738a; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; }.inspector-error { display: flex; gap: 6px; padding: 9px 10px; margin-top: 14px; color: #a3564f; background: #fff1f0; font-size: 11px; line-height: 1.5; }.detail-empty { display: flex; height: 100%; min-height: 500px; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #9aa3b1; font-size: 12px; }.detail-empty .el-icon { color: #b8c3d3; font-size: 34px; }
.payload-details { margin-top: 14px; border-top: 1px solid #edf0f4; }.payload-details summary { padding: 12px 0 2px; color: #58677f; font-size: 11px; cursor: pointer; }.payload-details summary small { margin-left: 6px; color: #a0a8b4; font-size: 10px; }.payload-details h4 { margin: 12px 0 6px; color: #7c8799; font-size: 10px; font-weight: 500; }.payload-details pre { max-height: 240px; overflow: auto; padding: 10px; margin: 0; border: 1px solid #edf0f4; background: #f7f8fa; color: #4f5c70; font: 10px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 1180px) { .trace-filters { grid-template-columns: repeat(3, 1fr); }.filter-wide { grid-column: span 2; }.filter-actions { justify-content: flex-end; } }
@media (max-width: 900px) { .trace-workspace { grid-template-columns: 1fr; }.trace-list-panel { border-right: 0; border-bottom: 1px solid var(--line); }.trace-detail-panel { min-height: 520px; }.dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.dashboard-metric:nth-child(2) { border-right: 0; }.dashboard-metric:nth-child(n + 3) { border-top: 1px solid #edf0f4; }.dashboard-metric:nth-child(3) { padding-left: 4px; } }
@media (max-width: 720px) { .trace-dashboard { padding: 12px 14px; }.dashboard-metric { gap: 9px; padding: 9px 10px; }.dashboard-metric:first-child { padding-left: 0; }.dashboard-metric:nth-child(3) { padding-left: 0; }.metric-copy strong { font-size: 17px; }.trace-filter-panel, .trace-list-panel, .trace-detail-panel { padding-left: 16px; padding-right: 16px; }.trace-filters { grid-template-columns: 1fr 1fr; }.filter-wide { grid-column: span 2; }.filter-actions { grid-column: span 2; justify-content: flex-start; }.trace-row { grid-template-columns: 24px minmax(0, 1fr) 16px; gap: 8px; }.trace-row-type, .trace-row-duration { display: none; }.detail-facts { grid-template-columns: repeat(2, 1fr); }.trace-detail-panel { min-height: auto; }.span-inspector dl { grid-template-columns: 1fr; } }
@media (max-width: 430px) { .dashboard-heading { align-items: flex-start; flex-direction: column; gap: 7px; }.dashboard-metrics { grid-template-columns: 1fr; }.dashboard-metric, .dashboard-metric:nth-child(2), .dashboard-metric:nth-child(n + 3) { min-height: 60px; padding: 7px 0; border-top: 1px solid #edf0f4; border-right: 0; }.dashboard-metric:first-child { border-top: 0; }.trace-filters { grid-template-columns: 1fr; }.filter-wide, .filter-actions { grid-column: auto; }.trace-row-main strong { max-width: 180px; }.panel-heading { align-items: flex-start; flex-direction: column; gap: 8px; }.detail-heading h2 { max-width: 170px; } }
</style>
