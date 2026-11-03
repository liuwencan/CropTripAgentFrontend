<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Calendar, Location, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import AdminPageShell from '@/views/admin/AdminPageShell.vue'
import { tripApi } from '@/api/tripApi'
import type { PageResponse } from '@/types/api'
import type { TripApprovalRecord, TripOrder, TripOrderStatus } from '@/types/trip'
import { formatTripTime, orderStatus, tripApprovalStatuses, tripOrderStatuses } from '@/utils/trip'

const query = reactive<{ pageNo: number; pageSize: number; status: TripOrderStatus | ''; destination: string }>({ pageNo: 1, pageSize: 10, status: '', destination: '' })
const result = ref<PageResponse<TripOrder>>({ success: true, data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0 })
const records = ref<TripApprovalRecord[]>([])
const loading = ref(false)
const error = ref('')
const selected = ref<TripOrder | null>(null)
const approval = computed(() => records.value.find((record) => record.orderId === selected.value?.id || record.id === selected.value?.approvalId))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [orders, approvals] = await Promise.all([
      tripApi.orders(query),
      tripApi.approvalRecords({ pageNo: 1, pageSize: 100 }),
    ])
    result.value = orders
    records.value = approvals.data || []
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '行程加载失败'
  } finally {
    loading.value = false
  }
}

function search() { query.pageNo = 1; load() }
function reset() { query.status = ''; query.destination = ''; search() }
function showDetails(row: TripOrder) { selected.value = row }
onMounted(load)
</script>

<template>
  <AdminPageShell title="我的行程" description="查看本人提交的出差申请及审批进度。">
    <el-card class="trip-data-card">
      <div class="trip-overview"><div><strong>{{ result.totalCount }}</strong><span>份出差申请</span></div><span>状态以审批记录为准</span></div>
      <form class="trip-toolbar" @submit.prevent="search">
        <el-input v-model="query.destination" :prefix-icon="Search" clearable aria-label="搜索目的地" placeholder="搜索目的地" @clear="search" />
        <el-select v-model="query.status" clearable aria-label="按申请状态筛选" placeholder="全部状态" @change="search">
          <el-option v-for="item in tripOrderStatuses" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :icon="Refresh" aria-label="重置筛选" @click="reset">重置</el-button>
      </form>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="还没有出差申请" @row-click="showDetails">
        <el-table-column prop="id" label="申请编号" min-width="190"><template #default="{ row }"><button class="trip-id-link" @click.stop="showDetails(row)">{{ row.id }}</button></template></el-table-column>
        <el-table-column label="行程" min-width="220"><template #default="{ row }"><div class="trip-route"><strong>{{ row.departureCity || '未填写' }} <span>→</span> {{ row.destination || '未填写' }}</strong><small><el-icon><Calendar /></el-icon>{{ row.departureDate || '—' }} 至 {{ row.returnDate || '—' }}</small></div></template></el-table-column>
        <el-table-column label="申请状态" width="125"><template #default="{ row }"><el-tag :type="orderStatus(row.status).type" effect="plain" size="small">{{ orderStatus(row.status).label }}</el-tag></template></el-table-column>
        <el-table-column label="审批进度" width="130"><template #default="{ row }"><el-tag v-if="records.find((record) => record.orderId === row.id || record.id === row.approvalId)" :type="tripApprovalStatuses[records.find((record) => record.orderId === row.id || record.id === row.approvalId)!.status]?.type || 'info'" effect="plain" size="small">{{ tripApprovalStatuses[records.find((record) => record.orderId === row.id || record.id === row.approvalId)!.status]?.label || '未知状态' }}</el-tag><span v-else class="muted">暂无记录</span></template></el-table-column>
        <el-table-column prop="createdAt" label="提交时间" min-width="155"><template #default="{ row }">{{ formatTripTime(row.createdAt) }}</template></el-table-column>
        <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="primary" @click.stop="showDetails(row)">详情</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" />
    </el-card>

    <el-drawer v-model="selected" title="出差申请详情" size="min(520px, 94vw)" destroy-on-close>
      <template v-if="selected">
        <div class="trip-detail-status"><div><span>申请状态</span><el-tag :type="orderStatus(selected.status).type" effect="plain">{{ orderStatus(selected.status).label }}</el-tag></div><div v-if="approval"><span>审批状态</span><el-tag :type="tripApprovalStatuses[approval.status]?.type || 'info'" effect="plain">{{ tripApprovalStatuses[approval.status]?.label || approval.status }}</el-tag></div></div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="申请编号">{{ selected.id }}</el-descriptions-item>
          <el-descriptions-item label="出发城市"><el-icon><Location /></el-icon> {{ selected.departureCity || '—' }}</el-descriptions-item>
          <el-descriptions-item label="目的地">{{ selected.destination || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出发日期">{{ selected.departureDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="返回日期">{{ selected.returnDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出差事由">{{ selected.purpose || '—' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTripTime(selected.createdAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="approval" label="审批意见">{{ approval.remark || '暂无意见' }}</el-descriptions-item>
          <el-descriptions-item v-if="approval" label="审批更新时间">{{ formatTripTime(approval.updateTime || approval.submitTime) }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </AdminPageShell>
</template>

<style scoped>
.trip-data-card { margin-bottom: 18px; }
.trip-overview { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 20px; color: var(--text-muted); font-size: 12px; }
.trip-overview > div { display: flex; align-items: baseline; gap: 8px; }.trip-overview strong { color: var(--text); font-size: 22px; font-weight: 550; }
.trip-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }.trip-toolbar .el-input { width: min(260px, 100%); }.trip-toolbar .el-select { width: 150px; }
.trip-id-link { padding: 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font: inherit; text-align: left; overflow-wrap: anywhere; }
.trip-route { display: flex; flex-direction: column; gap: 7px; }.trip-route strong { color: var(--text); font-weight: 500; }.trip-route strong span { padding: 0 5px; color: #8792a4; }.trip-route small { display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 12px; }
.trip-detail-status { display: flex; flex-wrap: wrap; gap: 28px; margin-bottom: 22px; }.trip-detail-status > div { display: flex; align-items: center; gap: 10px; }.trip-detail-status > div > span { color: var(--text-muted); font-size: 13px; }
:deep(.el-descriptions__label) { width: 112px; }
@media (max-width: 600px) { .trip-toolbar { align-items: stretch; }.trip-toolbar .el-input { width: 100%; }.trip-toolbar .el-select { flex: 1; }.trip-overview { align-items: flex-start; flex-direction: column; gap: 5px; } }
</style>
