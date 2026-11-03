<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminPageShell from './AdminPageShell.vue'
import { tripApi } from '@/api/tripApi'
import type { PageResponse } from '@/types/api'
import type { TripApprovalRecord } from '@/types/trip'
import { formatTripTime, parseApprovalForm } from '@/utils/trip'

const query = reactive({ pageNo: 1, pageSize: 10 })
const result = ref<PageResponse<TripApprovalRecord>>({ success: true, data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0 })
const loading = ref(false)
const error = ref('')
const busyId = ref('')
const details = ref<TripApprovalRecord | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try { result.value = await tripApi.pendingApprovals(query) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '待审批行程加载失败' }
  finally { loading.value = false }
}

async function decide(row: TripApprovalRecord, decision: 'APPROVED' | 'REJECTED') {
  let remark = ''
  try {
    const response = await ElMessageBox.prompt(
      decision === 'REJECTED' ? '请填写驳回原因，申请人可在我的行程中查看。' : '可填写审批意见，留空也可通过。',
      decision === 'REJECTED' ? '驳回出差申请' : '通过出差申请',
      {
        inputType: 'textarea',
        inputPlaceholder: decision === 'REJECTED' ? '驳回原因（必填，最多 512 字）' : '审批意见（选填）',
        inputValidator: (value) => decision === 'REJECTED' && !value.trim() ? '请填写驳回原因' : value.length <= 512 || '审批意见不能超过 512 字',
        confirmButtonText: decision === 'REJECTED' ? '确认驳回' : '确认通过',
        cancelButtonText: '取消',
      },
    )
    remark = response.value.trim()
  } catch { return }
  busyId.value = row.id
  try {
    await tripApi.decide(row.id, decision, remark)
    ElMessage.success(decision === 'APPROVED' ? '申请已通过' : '申请已驳回')
    await load()
    if (details.value?.id === row.id) details.value = null
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审批失败，请刷新后重试')
  } finally { busyId.value = '' }
}

onMounted(load)
</script>

<template>
  <AdminPageShell title="行程管理" description="审核员工提交的出差申请，审批结果会同步到申请人的行程状态。">
    <el-card class="trip-data-card">
      <div class="data-section-heading"><h2>待审批申请<span>{{ result.totalCount }} 份待处理</span></h2><el-button @click="load" :loading="loading">刷新</el-button></div>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="当前没有待审批申请">
        <el-table-column label="申请人" width="125"><template #default="{ row }"><span class="applicant"><span class="applicant-avatar">{{ row.userId?.slice(0, 1).toUpperCase() || 'U' }}</span>{{ row.userId || '—' }}</span></template></el-table-column>
        <el-table-column label="出差行程" min-width="230"><template #default="{ row }"><div class="trip-route"><strong>{{ parseApprovalForm(row.approvalForm).departureCity || '未填写' }} <span>→</span> {{ parseApprovalForm(row.approvalForm).destination || row.title }}</strong><small>{{ parseApprovalForm(row.approvalForm).departureDate || '—' }} 至 {{ parseApprovalForm(row.approvalForm).returnDate || '—' }}</small></div></template></el-table-column>
        <el-table-column label="出差事由" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ parseApprovalForm(row.approvalForm).purpose || '—' }}</template></el-table-column>
        <el-table-column prop="submitTime" label="提交时间" min-width="155"><template #default="{ row }">{{ formatTripTime(row.submitTime) }}</template></el-table-column>
        <el-table-column label="操作" width="180" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="details = row">详情</el-button><el-button link type="success" :loading="busyId === row.id" @click="decide(row, 'APPROVED')">通过</el-button><el-button link type="danger" :disabled="Boolean(busyId)" @click="decide(row, 'REJECTED')">驳回</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" />
    </el-card>
    <el-drawer v-model="details" title="出差申请详情" size="min(520px, 94vw)" destroy-on-close>
      <template v-if="details">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="申请人">{{ details.userId }}</el-descriptions-item>
          <el-descriptions-item label="申请编号">{{ details.orderId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出发城市">{{ parseApprovalForm(details.approvalForm).departureCity || '—' }}</el-descriptions-item>
          <el-descriptions-item label="目的地">{{ parseApprovalForm(details.approvalForm).destination || details.title }}</el-descriptions-item>
          <el-descriptions-item label="出发日期">{{ parseApprovalForm(details.approvalForm).departureDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="返回日期">{{ parseApprovalForm(details.approvalForm).returnDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出差事由">{{ parseApprovalForm(details.approvalForm).purpose || '—' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTripTime(details.submitTime) }}</el-descriptions-item>
        </el-descriptions>
        <div class="drawer-actions"><el-button type="success" :loading="busyId === details.id" @click="decide(details, 'APPROVED')">通过申请</el-button><el-button type="danger" :disabled="Boolean(busyId)" @click="decide(details, 'REJECTED')">驳回申请</el-button></div>
      </template>
    </el-drawer>
  </AdminPageShell>
</template>

<style scoped>
.trip-data-card { margin-bottom: 18px; }.applicant { display: inline-flex; align-items: center; gap: 9px; color: var(--text); }.applicant-avatar { display: grid; width: 28px; aspect-ratio: 1; place-items: center; border-radius: 50%; background: #e7edf8; color: #516990; font-size: 11px; }
.trip-route { display: flex; flex-direction: column; gap: 7px; }.trip-route strong { font-weight: 500; }.trip-route strong span { padding: 0 5px; color: #8792a4; }.trip-route small { color: var(--text-muted); font-size: 12px; }.drawer-actions { display: flex; gap: 10px; margin-top: 24px; }
</style>
