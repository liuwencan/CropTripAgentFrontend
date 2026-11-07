<script setup lang="ts">
import { Check, Clock, Loading } from '@element-plus/icons-vue'
import type { AgentPlan, PlanTask } from '@/types/conversation'

const props = defineProps<{ plans: AgentPlan[] }>()

const taskState = (task: PlanTask) => task.state === 'done' ? 'done'
  : task.state === 'in_progress' || task.state === 'in_progess' ? 'in-progress' : 'todo'
const taskLabel = (task: PlanTask) => taskState(task) === 'done' ? '已完成'
  : taskState(task) === 'in-progress' ? '处理中' : '待执行'
const taskIcon = (task: PlanTask) => taskState(task) === 'done' ? Check
  : taskState(task) === 'in-progress' ? Loading : Clock
</script>

<template>
  <section class="plan-list" aria-label="智能体计划">
    <article v-for="(plan, planIndex) in plans" :key="`${plan.agentName}-${plan.planName}-${planIndex}`" class="plan">
      <header class="plan-header">
        <div class="agent-mark" aria-hidden="true">AI</div>
        <div class="plan-heading">
          <strong class="agent-name">{{ plan.agentName || '未知智能体' }}</strong>
          <span class="plan-name">{{ plan.planName || '未命名计划' }}</span>
        </div>
        <span class="task-count">{{ plan.tasks.length }} 项任务</span>
      </header>
      <ol class="tasks">
        <li v-for="task in plan.tasks" :key="`${task.idx}-${task.name}`" class="task" :class="`is-${taskState(task)}`">
          <span class="task-marker" aria-hidden="true"><el-icon><component :is="taskIcon(task)" /></el-icon></span>
          <span class="task-name">{{ task.name }}</span>
          <span class="task-state"><el-icon><component :is="taskIcon(task)" /></el-icon>{{ taskLabel(task) }}</span>
        </li>
      </ol>
    </article>
  </section>
</template>

<style scoped>
.plan-list { display: grid; gap: 12px; margin: 0 0 18px; }
.plan { overflow: hidden; border: 1px solid #e3e7ed; border-radius: 6px; background: #fff; }
.plan-header { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 13px 15px; border-bottom: 1px solid #e9ecf1; background: #f8f9fb; }
.agent-mark { display: grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; border: 1px solid #cad8f3; border-radius: 6px; background: #edf3ff; color: #4266a8; font-size: 10px; font-weight: 700; }
.plan-heading { display: grid; min-width: 0; gap: 2px; }
.agent-name { overflow-wrap: anywhere; color: #303b4d; font-size: 12px; font-weight: 650; }
.plan-name { overflow-wrap: anywhere; color: #717c8d; font-size: 11px; }
.task-count { flex: 0 0 auto; margin-left: auto; color: #808999; font-size: 10px; }
.tasks { display: grid; margin: 0; padding: 4px 15px; list-style: none; }
.task { display: flex; min-height: 42px; min-width: 0; align-items: center; gap: 10px; border-bottom: 1px solid #f0f1f4; }
.task:last-child { border-bottom: 0; }
.task-marker { display: grid; width: 20px; height: 20px; flex: 0 0 20px; place-items: center; border-radius: 50%; background: #f0f2f5; color: #929aaa; font-size: 12px; }
.task-name { min-width: 0; flex: 1; overflow-wrap: anywhere; color: #424d5e; font-size: 12px; line-height: 1.5; }
.task-state { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 4px; color: #8a93a1; font-size: 10px; }
.is-done .task-marker, .is-done .task-state { color: #358267; }
.is-done .task-marker { background: #e8f4ef; }
.is-in-progress .task-marker, .is-in-progress .task-state { color: #4266a8; }
.is-in-progress .task-marker { background: #edf3ff; }
.is-in-progress .task-state .el-icon { animation: plan-spin 1s linear infinite; }
@keyframes plan-spin { to { transform: rotate(360deg); } }
@media (max-width: 520px) { .plan-header { padding: 11px 12px; }.tasks { padding: 4px 12px; }.task { gap: 8px; }.task-state { font-size: 9px; } }
@media (prefers-reduced-motion: reduce) { .is-in-progress .task-state .el-icon { animation: none; } }
</style>
