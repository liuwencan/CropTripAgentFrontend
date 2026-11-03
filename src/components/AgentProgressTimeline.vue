<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, Check, Clock, Close, Loading, Warning } from '@element-plus/icons-vue'
import MarkdownContent from './MarkdownContent.vue'
import type { AgentOutput, AssistantMessageStatus, ProgressStatus, ToolCall, ToolCallStatus } from '@/types/conversation'

const props = defineProps<{ tools?: ToolCall[]; outputs?: AgentOutput[]; status?: AssistantMessageStatus }>()

type TimelineEntry = { kind: 'tool'; value: ToolCall } | { kind: 'thinking'; value: AgentOutput }
interface AgentGroup { key: string; agentId?: string | null; name: string; entries: TimelineEntry[] }

const agentNames: Record<string, string> = {
  MasterAgent: '主智能体',
  OrderManagementAgent: '行程单智能体',
  TripOrderManagementAgent: '行程单智能体',
  GeneralInfoAgent: '通用信息智能体',
}
const toolNames: Record<string, string> = { get_userinfo: '获取用户信息', ask_user: '请求用户补充信息' }
const collapsedGroups = ref<string[]>([])
const statusLabels: Record<ToolCallStatus, string> = {
  running: '正在执行', completed: '执行完成', suspended: '已挂起', success: '执行成功',
  failed: '执行失败', cancelled: '已停止', interrupted: '未收到结果',
}

const groups = computed(() => {
  const entries: TimelineEntry[] = [
    ...(props.tools ?? []).map((value): TimelineEntry => ({ kind: 'tool', value })),
    ...(props.outputs ?? []).map((value): TimelineEntry => ({ kind: 'thinking', value })),
  ]
  entries.sort((a, b) => (a.value.timestamp ?? 0) - (b.value.timestamp ?? 0) || (a.value.sequence ?? 0) - (b.value.sequence ?? 0))
  const result: AgentGroup[] = []
  const occurrences = new Map<string, number>()
  for (const entry of entries) {
    const agent = entry.value
    const name = agentNames[agent.agentName ?? ''] ?? agent.agentName ?? '未知智能体'
    const previous = result[result.length - 1]
    // Only group adjacent activity: A → B → A must stay in that order.
    if (previous && (agent.agentId ? previous.agentId === agent.agentId : !previous.agentId && previous.name === name)) previous.entries.push(entry)
    else {
      const identity = agent.agentId ? `id-${agent.agentId}` : `name-${name}`
      const occurrence = occurrences.get(identity) ?? 0
      occurrences.set(identity, occurrence + 1)
      result.push({ key: `${identity}-${occurrence}`, agentId: agent.agentId, name, entries: [entry] })
    }
  }
  return result
})

watch(() => props.status, (status) => {
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    collapsedGroups.value = groups.value.map((group) => group.key)
  }
}, { immediate: true })

function groupStatus(group: AgentGroup): ToolCallStatus {
  const statuses = group.entries.map((entry) => entry.value.status)
  for (const status of ['running', 'suspended', 'failed', 'cancelled', 'interrupted'] as const) {
    if (statuses.includes(status)) return status
  }
  return 'completed'
}

function statusIcon(status: ToolCallStatus) {
  if (status === 'running') return Loading
  if (status === 'suspended') return Clock
  if (status === 'failed' || status === 'interrupted') return Warning
  if (status === 'cancelled') return Close
  return Check
}

function isCollapsed(group: AgentGroup): boolean {
  return collapsedGroups.value.includes(group.key)
}

function toggleGroup(group: AgentGroup) {
  collapsedGroups.value = isCollapsed(group)
    ? collapsedGroups.value.filter((key) => key !== group.key)
    : [...collapsedGroups.value, group.key]
}

function outputStatusLabel(status: ProgressStatus): string {
  return status === 'running' ? '正在输出' : status === 'completed' ? '输出完成' : statusLabels[status]
}

function toolLabel(tool: ToolCall): string {
  return tool.tooldesc || toolNames[tool.toolName] || agentNames[tool.toolName] || tool.toolName
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
  <section v-if="groups.length" class="agent-progress" aria-label="智能体调用时间线">
    <div class="timeline-heading"><strong>执行过程</strong><span>按调用时间排列</span></div>
    <ol class="agent-timeline">
      <li v-for="group in groups" :key="group.key" class="agent-step" :class="`is-${groupStatus(group)}`">
        <span class="agent-node" aria-hidden="true"><el-icon :class="{ 'is-loading': groupStatus(group) === 'running' }"><component :is="statusIcon(groupStatus(group))" /></el-icon></span>
        <div class="agent-heading">
          <strong :title="group.agentId || undefined">{{ group.name }}</strong>
          <time v-if="formatTime(group.entries[0]?.value.timestamp)" :datetime="dateTime(group.entries[0]?.value.timestamp)">{{ formatTime(group.entries[0]?.value.timestamp) }}</time>
          <span class="progress-status" role="status">{{ groupStatus(group) === 'running' ? '处理中' : groupStatus(group) === 'completed' ? '已完成' : statusLabels[groupStatus(group)] }}</span>
          <button type="button" class="agent-toggle" :aria-expanded="!isCollapsed(group)" :aria-controls="`${group.key}-activities`" :aria-label="`${isCollapsed(group) ? '展开' : '收起'}${group.name}执行过程`" :title="`${isCollapsed(group) ? '展开' : '收起'}${group.name}执行过程`" @click="toggleGroup(group)"><el-icon :class="{ 'is-collapsed': isCollapsed(group) }"><ArrowDown /></el-icon></button>
        </div>
        <ol :id="`${group.key}-activities`" v-show="!isCollapsed(group)" class="agent-activities">
          <li v-for="(entry, index) in group.entries" :key="entry.kind === 'tool' ? `${entry.value.agentId}:${entry.value.toolCallId}` : entry.value.id" class="agent-activity" :class="[`is-${entry.value.status}`, `activity-${entry.kind}`]">
            <template v-if="entry.kind === 'tool'">
              <div class="activity-heading">
                <span class="activity-number" aria-hidden="true">{{ index + 1 }}</span>
                <strong>{{ toolLabel(entry.value) }}</strong>
                <span class="activity-status" role="status"><el-icon :class="{ 'is-loading': entry.value.status === 'running' }"><component :is="statusIcon(entry.value.status)" /></el-icon>{{ statusLabels[entry.value.status] }}</span>
              </div>
              <div class="tool-meta"><code>{{ entry.value.toolName }}</code><time v-if="formatTime(entry.value.timestamp)" :datetime="dateTime(entry.value.timestamp)">{{ formatTime(entry.value.timestamp) }}<template v-if="entry.value.completedAt !== undefined"> — {{ formatTime(entry.value.completedAt) }}</template></time><span v-if="duration(entry.value)">耗时 {{ duration(entry.value) }}</span></div>
              <details v-if="entry.value.input !== undefined && entry.value.input !== null" class="tool-input"><summary>调用参数</summary><pre>{{ formatValue(entry.value.input) }}</pre></details>
              <details v-if="entry.value.result !== undefined" class="tool-output"><summary>执行结果</summary><pre>{{ formatValue(entry.value.result) }}</pre></details>
              <p v-else class="result-placeholder">{{ entry.value.status === 'running' ? '等待工具返回结果…' : entry.value.status === 'suspended' ? '等待补充信息或外部处理后继续' : entry.value.status === 'failed' ? '执行失败，未返回结果' : entry.value.status === 'cancelled' ? '已停止，未返回结果' : entry.value.status === 'interrupted' ? '响应已结束，未收到工具结果' : '无文本输出' }}</p>
            </template>
            <template v-else>
              <div class="activity-heading"><strong>智能体输出</strong><span class="activity-status" role="status">{{ outputStatusLabel(entry.value.status) }}</span></div>
              <MarkdownContent class="agent-output" :source="entry.value.content" />
            </template>
          </li>
        </ol>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.agent-progress { margin-bottom: 22px; color: var(--text); font-size: 12px; }
.timeline-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 17px; }
.timeline-heading strong { font-size: 12px; font-weight: 600; }
.timeline-heading > span { color: var(--text-muted); font-size: 11px; }
.agent-timeline, .agent-activities { margin: 0; padding: 0; list-style: none; }
.agent-step { position: relative; padding: 0 0 21px 29px; }
.agent-step::before { position: absolute; top: 23px; bottom: 0; left: 9px; width: 1px; background: var(--line); content: ''; }
.agent-step:last-child { padding-bottom: 0; }
.agent-step:last-child::before { bottom: 12px; }
.agent-node { position: absolute; left: 0; top: 0; display: grid; width: 19px; height: 23px; place-items: center; background: var(--surface); color: var(--accent); font-size: 14px; }
.agent-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 23px; margin-bottom: 9px; }
.agent-heading > strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
.agent-heading time { color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.progress-status { color: var(--text-muted); font-size: 11px; }
.agent-toggle { display: grid; width: 27px; height: 27px; flex: 0 0 27px; place-items: center; margin-left: auto; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; }
.agent-toggle:hover { background: #eef0f4; color: var(--text); }
.agent-toggle :deep(.el-icon) { transition: transform 160ms ease; }
.agent-toggle :deep(.el-icon.is-collapsed) { transform: rotate(-90deg); }
.agent-activities { display: grid; gap: 10px; }
.agent-activity { min-width: 0; padding: 11px 13px; border-left: 2px solid var(--line); background: #f8f9fb; }
.activity-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; line-height: 1.6; }
.activity-number { color: var(--text-muted); font-size: 11px; }
.activity-heading > strong { overflow-wrap: anywhere; font-weight: 500; }
.activity-status { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--text-muted); font-size: 11px; }
.tool-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 12px; margin-top: 5px; color: var(--text-muted); font-size: 10px; }
.tool-meta code { overflow-wrap: anywhere; font: inherit; }
.tool-meta time { font-variant-numeric: tabular-nums; }
.tool-input { margin-top: 9px; color: var(--text-muted); }
.tool-input summary { width: fit-content; padding: 2px 0; cursor: pointer; font-size: 11px; }
.tool-input summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.tool-output { margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); color: var(--text-muted); }
.tool-output summary { width: fit-content; padding: 2px 0; cursor: pointer; font-size: 11px; }
.tool-output summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
pre { max-height: 320px; margin: 5px 0 0; overflow: auto; color: #505c70; font: inherit; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.result-placeholder { margin: 9px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
.activity-thinking { background: transparent; }
.agent-output { margin-top: 7px; font-size: 12px; }
.is-running > .activity-heading .activity-status, .is-running > .agent-heading .progress-status { color: var(--accent); }
.is-suspended > .activity-heading .activity-status, .is-suspended > .agent-node, .is-suspended > .agent-heading .progress-status { color: #88620a; }
.is-suspended.agent-activity { border-left-color: #c59c37; }
.is-failed > .activity-heading .activity-status, .is-failed > .agent-node, .is-failed > .agent-heading .progress-status { color: #a14b48; }
.is-failed.agent-activity { border-left-color: #ba6865; }
.is-interrupted > .activity-heading .activity-status, .is-interrupted > .agent-node { color: #88620a; }
.is-cancelled > .agent-node { color: var(--text-muted); }
.is-success > .activity-heading .activity-status { color: #398168; }
.is-loading { animation: progress-spin 1s linear infinite; }
@keyframes progress-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) { .agent-step { padding-left: 25px; }.agent-activity { padding: 10px; }.activity-status { margin-left: 0; }.tool-meta { gap: 4px 8px; } }
@media (prefers-reduced-motion: reduce) { .is-loading { animation: none; } }
</style>
