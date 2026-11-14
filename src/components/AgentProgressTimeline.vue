<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, Check, Clock, Close, Loading, Warning } from '@element-plus/icons-vue'
import type { AgentOutput, AssistantMessageStatus, ToolCall, ToolCallStatus } from '@/types/conversation'

const props = defineProps<{ tools?: ToolCall[]; outputs?: AgentOutput[]; status?: AssistantMessageStatus }>()
const collapsed = ref(false)

watch(() => props.status, (status) => {
  if (status === 'completed' || status === 'failed' || status === 'cancelled') collapsed.value = true
}, { immediate: true })

const agentNames: Record<string, string> = {
  MasterAgent: '主智能体',
  OrderManagementAgent: '行程单智能体',
  TripOrderManagementAgent: '行程单智能体',
  GeneralInfoAgent: '通用信息智能体',
}
const toolNames: Record<string, string> = { get_userinfo: '获取用户信息', ask_user: '请求用户补充信息' }
const statusLabels: Record<ToolCallStatus, string> = {
  running: '正在执行',
  completed: '执行完成',
  suspended: '已挂起',
  success: '执行成功',
  failed: '执行失败',
  cancelled: '已停止',
  interrupted: '未收到结果',
}

const tools = computed(() => [...(props.tools ?? [])].sort((a, b) => (
  (a.timestamp ?? 0) - (b.timestamp ?? 0) || (a.sequence ?? 0) - (b.sequence ?? 0)
)))
const executionState = computed(() => {
  if (tools.value.some((tool) => tool.status === 'running')) return 'running'
  if (tools.value.some((tool) => tool.status === 'failed') || props.status === 'failed') return 'failed'
  if (tools.value.some((tool) => tool.status === 'suspended') || props.status === 'awaiting-input') return 'suspended'
  if (tools.value.some((tool) => tool.status === 'cancelled') || props.status === 'cancelled') return 'cancelled'
  if (tools.value.some((tool) => tool.status === 'interrupted')) return 'interrupted'
  return 'done'
})

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

function statusIcon(status: ToolCallStatus) {
  if (status === 'running') return Loading
  if (status === 'suspended') return Clock
  if (status === 'failed' || status === 'interrupted') return Warning
  if (status === 'cancelled') return Close
  return Check
}

function agentLabel(agentName?: string | null): string {
  if (!agentName) return ''
  return agentNames[agentName] ?? agentName
}

function toolLabel(tool: ToolCall): string {
  const agent = agentLabel(tool.agentName)
  const description = tool.tooldesc || toolNames[tool.toolName] || tool.toolName
  if (agent && description) return `${agent}-${description}`
  return agent || description || '工具调用'
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '无文本输出'
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
    } catch { return value }
  }
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

function formatTime(timestamp?: number): string {
  if (timestamp === undefined || !Number.isFinite(new Date(timestamp).getTime())) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function dateTime(timestamp?: number): string | undefined {
  return timestamp !== undefined && Number.isFinite(new Date(timestamp).getTime()) ? new Date(timestamp).toISOString() : undefined
}

function duration(tool: ToolCall): string {
  if (tool.timestamp === undefined || tool.completedAt === undefined || tool.completedAt < tool.timestamp) return ''
  const elapsed = tool.completedAt - tool.timestamp
  return elapsed < 1000 ? `${elapsed} 毫秒` : `${(elapsed / 1000).toFixed(1)} 秒`
}
</script>

<template>
  <section v-if="tools.length" class="agent-progress" aria-label="工具调用时间线">
    <div class="timeline-heading">
      <div class="timeline-title"><span class="timeline-marker" :class="`is-${executionState}`" aria-hidden="true"></span><strong>执行过程</strong><span>工具调用</span></div>
      <button class="timeline-toggle" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? '展开执行过程' : '折叠执行过程'" :title="collapsed ? '展开执行过程' : '折叠执行过程'" @click="toggleCollapsed">
        <el-icon :class="{ 'is-collapsed': collapsed }"><ArrowDown /></el-icon>
      </button>
    </div>
    <ol v-if="!collapsed" class="agent-timeline">
      <li v-for="(tool, index) in tools" :key="`${tool.agentId ?? 'agent'}:${tool.toolCallId}:${index}`" class="agent-step" :class="`is-${tool.status}`">
        <span class="agent-node" aria-hidden="true"><el-icon :class="{ 'is-loading': tool.status === 'running' }"><component :is="statusIcon(tool.status)" /></el-icon></span>
        <div class="agent-activity" :class="`is-${tool.status}`">
          <div class="agent-heading activity-heading">
            <span class="activity-number" aria-hidden="true">{{ index + 1 }}</span>
            <strong>{{ toolLabel(tool) }}</strong>
            <span class="activity-status" role="status"><el-icon :class="{ 'is-loading': tool.status === 'running' }"><component :is="statusIcon(tool.status)" /></el-icon>{{ statusLabels[tool.status] }}</span>
          </div>
          <div class="tool-meta">
            <time v-if="formatTime(tool.timestamp)" :datetime="dateTime(tool.timestamp)">{{ formatTime(tool.timestamp) }}<template v-if="tool.completedAt !== undefined"> - {{ formatTime(tool.completedAt) }}</template></time>
            <span v-if="duration(tool)">耗时 {{ duration(tool) }}</span>
          </div>
          <details v-if="tool.input !== undefined && tool.input !== null" class="tool-input"><summary>调用参数</summary><pre>{{ formatValue(tool.input) }}</pre></details>
          <details v-if="tool.result !== undefined" class="tool-output"><summary>执行结果</summary><pre>{{ formatValue(tool.result) }}</pre></details>
          <p v-else class="result-placeholder">{{ tool.status === 'running' ? '等待工具返回结果' : tool.status === 'suspended' ? '等待补充信息或外部处理后继续' : tool.status === 'failed' ? '执行失败，未返回结果' : tool.status === 'cancelled' ? '已停止，未返回结果' : tool.status === 'interrupted' ? '响应已结束，未收到工具结果' : '无文本输出' }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.agent-progress { margin-bottom: 22px; color: var(--text); font-size: 12px; }
.timeline-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 11px; }
.timeline-title { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.timeline-marker { position: relative; z-index: 1; width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #c64c4c; box-shadow: 0 0 0 4px #f9eaea; }
.timeline-marker.is-done { background: var(--el-color-success); box-shadow: 0 0 0 4px var(--el-color-success-light-9); }
.timeline-marker.is-suspended { background: #b38320; box-shadow: 0 0 0 4px #f6f0df; }
.timeline-marker.is-cancelled, .timeline-marker.is-interrupted { background: #8a93a1; box-shadow: 0 0 0 4px #eef0f3; }
.timeline-marker.is-failed { background: #a14b48; box-shadow: 0 0 0 4px #f7eaea; }
.timeline-title strong { font-size: 12px; font-weight: 600; }
.timeline-title > span { color: var(--text-muted); font-size: 11px; }
.timeline-toggle { display: grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; }
.timeline-toggle:hover { background: #eef0f4; color: var(--text); }
.timeline-toggle :deep(.el-icon) { transition: transform 160ms ease; }
.timeline-toggle :deep(.el-icon.is-collapsed) { transform: rotate(-90deg); }
.agent-timeline { margin: 0; padding: 0; list-style: none; }
.agent-step { position: relative; padding: 0 0 14px 29px; }
.agent-step::before { position: absolute; top: 23px; bottom: 0; left: 9px; width: 1px; background: var(--line); content: ''; }
.agent-step:last-child { padding-bottom: 0; }
.agent-step:last-child::before { bottom: 12px; }
.agent-node { position: absolute; left: 0; top: 0; display: grid; width: 19px; height: 23px; place-items: center; background: var(--surface); color: var(--accent); font-size: 14px; }
.agent-activity { min-width: 0; padding: 11px 13px; border-left: 2px solid var(--line); background: #f8f9fb; }
.activity-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; line-height: 1.6; }
.activity-number { color: var(--text-muted); font-size: 11px; }
.activity-heading > strong { overflow-wrap: anywhere; font-weight: 500; }
.activity-status { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--text-muted); font-size: 11px; }
.tool-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 12px; margin-top: 5px; color: var(--text-muted); font-size: 10px; }
.tool-meta time { font-variant-numeric: tabular-nums; }
.tool-input { margin-top: 9px; color: var(--text-muted); }
.tool-input summary { width: fit-content; padding: 2px 0; cursor: pointer; font-size: 11px; }
.tool-input summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.tool-output { margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); color: var(--text-muted); }
.tool-output summary { width: fit-content; padding: 2px 0; cursor: pointer; font-size: 11px; }
.tool-output summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
pre { max-height: 320px; margin: 5px 0 0; overflow: auto; color: #505c70; font: inherit; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.result-placeholder { margin: 9px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
.is-running .activity-status, .is-running > .agent-node { color: var(--accent); }
.is-suspended .activity-status, .is-suspended > .agent-node { color: #88620a; }
.is-suspended .agent-activity { border-left-color: #c59c37; }
.is-failed .activity-status, .is-failed > .agent-node { color: #a14b48; }
.is-failed .agent-activity { border-left-color: #ba6865; }
.is-interrupted .activity-status, .is-interrupted > .agent-node { color: #88620a; }
.is-cancelled > .agent-node { color: var(--text-muted); }
.is-success .activity-status { color: #398168; }
.is-loading { animation: progress-spin 1s linear infinite; }
@keyframes progress-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) { .agent-step { padding-left: 25px; }.agent-activity { padding: 10px; }.activity-status { margin-left: 0; }.tool-meta { gap: 4px 8px; } }
@media (prefers-reduced-motion: reduce) { .is-loading { animation: none; } }
</style>
