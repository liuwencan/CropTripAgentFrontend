<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Calendar, Location, Refresh, Search, Tickets } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageShell from '@/components/PageShell.vue'
import { tripApi } from '@/api/tripApi'
import type { PageResponse } from '@/types/api'
import type { BookingRecord, TripApprovalRecord, TripOrder, TripOrderStatus } from '@/types/trip'
import { formatTripTime, orderStatus, tripApprovalStatuses, tripOrderStatuses } from '@/utils/trip'

const PAGE_SIZE = 6
const query = reactive({ pageNo: 1, pageSize: PAGE_SIZE, status: '' as TripOrderStatus | '', destination: '', departureCity: '', departureDate: '' })
const result = ref<PageResponse<TripOrder>>({ success: true, data: [], pageNo: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPage: 0 })
const records = ref<TripApprovalRecord[]>([])
const bookingsByTrip = ref<Record<string, BookingRecord[]>>({})
const bookingErrors = ref<Record<string, string>>({})
const loading = ref(false)
const error = ref('')
const cancellingId = ref('')
const selected = ref<TripOrder | null>(null)
const selectedBooking = ref<BookingRecord | null>(null)
const approvalByTrip = computed(() => {
  const approvals = new Map<string, TripApprovalRecord>()
  for (const record of records.value) {
    if (record.orderId) approvals.set(record.orderId, record)
  }
  return approvals
})
const selectedApproval = computed(() => selected.value && (approvalByTrip.value.get(selected.value.id)
  || records.value.find((record) => record.id === selected.value?.approvalId)))
const selectedBookings = computed(() => selected.value ? bookingsByTrip.value[selected.value.id] || [] : [])

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

    const tripIds = orders.data.map((trip) => trip.id)
    const bookingResults = await Promise.allSettled(tripIds.map((travelOrderId) =>
      tripApi.bookingRecords({ pageNo: 1, pageSize: 100, travelOrderId }),
    ))
    const nextBookings: Record<string, BookingRecord[]> = {}
    const nextErrors: Record<string, string> = {}
    bookingResults.forEach((bookingResult, index) => {
      const tripId = tripIds[index]
      if (bookingResult.status === 'fulfilled') nextBookings[tripId] = bookingResult.value.data || []
      else nextErrors[tripId] = bookingResult.reason instanceof Error ? bookingResult.reason.message : '预订记录加载失败'
    })
    bookingsByTrip.value = nextBookings
    bookingErrors.value = nextErrors
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '行程加载失败'
  } finally {
    loading.value = false
  }
}

function search() { query.pageNo = 1; load() }
function reset() {
  query.status = ''
  query.destination = ''
  query.departureCity = ''
  query.departureDate = ''
  search()
}
function bookingTypeLabel(type: BookingRecord['bizType']) {
  return ({ FLIGHT: '航班', HOTEL: '酒店', TRAIN: '高铁 / 火车', TICKET: '门票', CRUISE: '邮轮', VACATION: '度假' } as const)[type] || '其他预订'
}
function bookingStatusLabel(status: string) {
  return ({ CREATED: '已创建', PENDING_PAYMENT: '待支付', PAID: '已支付', CONFIRMED: '已确认', COMPLETED: '已完成', CANCELLED: '已取消', EXPIRED: '已过期', REFUNDED: '已退款', FAILED: '预订失败' } as Record<string, string>)[status] || status || '状态未知'
}
function bookingStatusType(status: string): 'info' | 'warning' | 'success' | 'danger' {
  if (['CONFIRMED', 'COMPLETED', 'PAID'].includes(status)) return 'success'
  if (['PENDING_PAYMENT', 'CREATED'].includes(status)) return 'warning'
  if (['CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED'].includes(status)) return 'info'
  return 'info'
}
function formatAmount(booking: BookingRecord) {
  if (booking.totalAmount === undefined || booking.totalAmount === null) return ''
  return `${booking.currency || 'CNY'} ${Number(booking.totalAmount).toFixed(2)}`
}
const selectedBookingDetails = computed(() => {
  if (!selectedBooking.value?.detail) return []
  try {
    const parsed: unknown = JSON.parse(selectedBooking.value.detail)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed as Record<string, unknown>).filter(([, value]) => value !== null && value !== '')
      .map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }))
  } catch { return [] }
})
const bookingCanBeCancelled = computed(() => {
  const booking = selectedBooking.value
  return Boolean(booking
    && ['FLIGHT', 'TRAIN'].includes(booking.bizType)
    && ['tuniu', 'tuniu-cli'].includes(booking.platform?.toLowerCase() || '')
    && ['CREATED', 'PENDING_PAYMENT', 'PAID', 'CONFIRMED'].includes(booking.status))
})
function showBookingDetails(booking: BookingRecord) { selectedBooking.value = booking }
function closeBookingDetails() { selectedBooking.value = null }
function cancelBooking() {
  ElMessage.info(bookingCanBeCancelled.value
    ? '页面暂未开放直接取消，请通过差旅助手发起途牛机票或火车预订取消。'
    : '这类预订暂不支持通过差旅助手取消，请联系对应平台处理。')
}
async function cancelTrip(trip: TripOrder) {
  try {
    await ElMessageBox.confirm(
      '确定取消这条已通过的行程吗？如有关联的已支付预订，需要先处理预订。',
      '取消行程',
      { type: 'warning', confirmButtonText: '确认取消', cancelButtonText: '暂不取消' },
    )
  } catch { return }

  cancellingId.value = trip.id
  try {
    const updated = await tripApi.cancelOrder(trip.id)
    result.value.data = result.value.data.map((item) => item.id === trip.id ? updated : item)
    if (selected.value?.id === trip.id) selected.value = updated
    ElMessage.success('行程已取消')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '取消失败，请刷新后重试')
  } finally {
    cancellingId.value = ''
  }
}
function showDetails(row: TripOrder) { selected.value = row }
onMounted(load)
</script>

<template>
  <PageShell title="我的行程" description="查看出差申请、审批进度和关联预订。">
    <section class="trip-page" aria-label="行程列表">
      <div class="trip-overview">
        <div><strong>{{ result.totalCount }}</strong><span>份出差申请</span></div>
        <span>每页 {{ PAGE_SIZE }} 个行程</span>
      </div>

      <form class="trip-toolbar" @submit.prevent="search">
        <el-input v-model="query.destination" :prefix-icon="Search" clearable aria-label="按目的地筛选" placeholder="目的地" @clear="search" />
        <el-input v-model="query.departureCity" :prefix-icon="Location" clearable aria-label="按出发城市筛选" placeholder="出发城市" @clear="search" />
        <el-date-picker v-model="query.departureDate" type="date" value-format="YYYY-MM-DD" aria-label="按出发日期筛选" placeholder="出发日期" clearable @change="search" />
        <el-select v-model="query.status" clearable aria-label="按申请状态筛选" placeholder="全部状态" @change="search">
          <el-option v-for="item in tripOrderStatuses" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :icon="Refresh" aria-label="重置筛选" @click="reset">重置</el-button>
      </form>

      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <div v-else v-loading="loading" class="trip-grid" :class="{ 'is-loading': loading }">
        <article v-for="trip in result.data" :key="trip.id" class="trip-card">
          <div class="trip-card-head">
            <div class="trip-route">
              <h2>{{ trip.departureCity || '未填写' }} <span aria-hidden="true">→</span> {{ trip.destination || '未填写' }}</h2>
              <p><el-icon><Calendar /></el-icon>{{ trip.departureDate || '—' }} 至 {{ trip.returnDate || '—' }}</p>
            </div>
            <el-tag :type="orderStatus(trip.status).type" effect="plain" size="small">{{ orderStatus(trip.status).label }}</el-tag>
          </div>

          <div class="trip-meta">
            <span>申请编号 <b>{{ trip.id }}</b></span>
          </div>

          <div class="booking-section">
            <div class="booking-heading"><strong><el-icon><Tickets /></el-icon>关联预订</strong><span>{{ bookingsByTrip[trip.id]?.length ?? (bookingErrors[trip.id] ? '—' : '…') }} 条</span></div>
            <p v-if="bookingErrors[trip.id]" class="booking-message error-message">{{ bookingErrors[trip.id] }} <button type="button" @click="load">重试</button></p>
            <p v-else-if="bookingsByTrip[trip.id]?.length === 0" class="booking-message">暂无关联预订</p>
            <div v-else-if="bookingsByTrip[trip.id]?.length" class="booking-list">
              <div v-for="booking in bookingsByTrip[trip.id]" :key="booking.bookingId" class="booking-row">
                <div class="booking-main">
                  <span class="booking-kind">{{ bookingTypeLabel(booking.bizType) }}</span>
                  <div class="booking-info">
                    <strong>{{ booking.title || booking.externalOrderNo || booking.platform || bookingTypeLabel(booking.bizType) }}</strong>
                    <small>{{ booking.startTime ? formatTripTime(booking.startTime) : formatTripTime(booking.bookedAt || booking.createdAt) }}<template v-if="booking.endTime"> 至 {{ formatTripTime(booking.endTime) }}</template></small>
                  </div>
                </div>
                <div class="booking-side">
                  <el-button link type="primary" @click="showBookingDetails(booking)">查看详情</el-button>
                  <span v-if="formatAmount(booking)" class="booking-amount">{{ formatAmount(booking) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="booking-message">正在加载预订记录…</p>
          </div>

          <div class="trip-card-foot">
            <el-button class="detail-button" @click="showDetails(trip)">查看详情</el-button>
            <el-button v-if="trip.status === 'APPROVED'" class="cancel-button" :loading="cancellingId === trip.id" :disabled="Boolean(cancellingId)" @click="cancelTrip(trip)">取消行程</el-button>
          </div>
        </article>
        <el-empty v-if="!loading && result.data.length === 0" description="没有符合条件的行程" />
      </div>

      <el-pagination v-model:current-page="query.pageNo" layout="total, prev, pager, next" :page-size="PAGE_SIZE" :total="result.totalCount" :disabled="loading" @current-change="load" />
    </section>

    <el-drawer :model-value="Boolean(selected)" title="出差申请详情" size="min(540px, 94vw)" destroy-on-close @close="selected = null">
      <template v-if="selected">
        <div class="trip-detail-status">
          <div><span>申请状态</span><el-tag :type="orderStatus(selected.status).type" effect="plain">{{ orderStatus(selected.status).label }}</el-tag></div>
          <div v-if="selectedApproval"><span>审批状态</span><el-tag :type="tripApprovalStatuses[selectedApproval.status]?.type || 'info'" effect="plain">{{ tripApprovalStatuses[selectedApproval.status]?.label || selectedApproval.status }}</el-tag></div>
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="申请编号">{{ selected.id }}</el-descriptions-item>
          <el-descriptions-item label="出发城市"><el-icon><Location /></el-icon> {{ selected.departureCity || '—' }}</el-descriptions-item>
          <el-descriptions-item label="目的地">{{ selected.destination || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出发日期">{{ selected.departureDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="返回日期">{{ selected.returnDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出差事由">{{ selected.purpose || '—' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTripTime(selected.createdAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedApproval" label="审批意见">{{ selectedApproval.remark || '暂无意见' }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedApproval" label="审批更新时间">{{ formatTripTime(selectedApproval.updateTime || selectedApproval.submitTime) }}</el-descriptions-item>
        </el-descriptions>
        <section class="drawer-bookings">
          <h3>关联预订 <span>{{ selectedBookings.length }} 条</span></h3>
          <p v-if="bookingErrors[selected.id]" class="booking-message error-message">{{ bookingErrors[selected.id] }}</p>
          <p v-else-if="selectedBookings.length === 0" class="booking-message">暂无关联预订</p>
          <div v-else class="booking-list">
            <div v-for="booking in selectedBookings" :key="booking.bookingId" class="booking-row">
              <div class="booking-main"><span class="booking-kind">{{ bookingTypeLabel(booking.bizType) }}</span><div class="booking-info"><strong>{{ booking.title || booking.externalOrderNo || booking.platform || bookingTypeLabel(booking.bizType) }}</strong><small>{{ booking.startTime ? formatTripTime(booking.startTime) : formatTripTime(booking.bookedAt || booking.createdAt) }}</small></div></div>
              <div class="booking-side"><el-button link type="primary" @click="showBookingDetails(booking)">查看详情</el-button><span v-if="formatAmount(booking)" class="booking-amount">{{ formatAmount(booking) }}</span></div>
            </div>
          </div>
        </section>
      </template>
    </el-drawer>

    <el-dialog :model-value="Boolean(selectedBooking)" class="booking-detail-dialog" width="min(720px, calc(100vw - 32px))" align-center destroy-on-close @close="closeBookingDetails">
      <template v-if="selectedBooking">
        <div class="booking-detail-head">
          <div>
            <span class="booking-detail-kind">{{ bookingTypeLabel(selectedBooking.bizType) }}</span>
            <h2>{{ selectedBooking.title || bookingTypeLabel(selectedBooking.bizType) }}</h2>
            <p>{{ selectedBooking.externalOrderNo ? `平台订单号 ${selectedBooking.externalOrderNo}` : `预订编号 ${selectedBooking.bookingId}` }}</p>
          </div>
          <el-tag :type="bookingStatusType(selectedBooking.status)" effect="plain">{{ bookingStatusLabel(selectedBooking.status) }}</el-tag>
        </div>
        <div class="booking-detail-amount">
          <span>订单金额</span>
          <strong>{{ formatAmount(selectedBooking) || '暂无金额' }}</strong>
        </div>
        <el-descriptions :column="2" border class="booking-descriptions">
          <el-descriptions-item label="预订平台">{{ selectedBooking.platform || '—' }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{ bookingTypeLabel(selectedBooking.bizType) }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ selectedBooking.contactName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ selectedBooking.contactPhone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="支付状态">{{ selectedBooking.paymentStatus || '—' }}</el-descriptions-item>
          <el-descriptions-item label="平台状态">{{ selectedBooking.externalStatus || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出行 / 入住开始">{{ formatTripTime(selectedBooking.startTime) }}</el-descriptions-item>
          <el-descriptions-item label="出行 / 入住结束">{{ formatTripTime(selectedBooking.endTime) }}</el-descriptions-item>
          <el-descriptions-item label="预订时间">{{ formatTripTime(selectedBooking.bookedAt || selectedBooking.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="关联行程">{{ selectedBooking.travelOrderId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ selectedBooking.remark || '—' }}</el-descriptions-item>
        </el-descriptions>
        <dl v-if="selectedBookingDetails.length" class="booking-extra-details">
          <div v-for="item in selectedBookingDetails" :key="item.key"><dt>{{ item.key }}</dt><dd>{{ item.value }}</dd></div>
        </dl>
        <div class="booking-dialog-actions">
          <el-button @click="closeBookingDetails">关闭</el-button>
          <el-button type="danger" @click="cancelBooking">取消预订</el-button>
        </div>
      </template>
    </el-dialog>
  </PageShell>
</template>

<style scoped>
.trip-page { min-width: 0; }
.trip-overview { display: flex; align-items: center; justify-content: space-between; padding: 2px 0 16px; color: var(--text-muted); font-size: 12px; }
.trip-overview > div { display: flex; align-items: baseline; gap: 8px; }
.trip-overview strong { color: var(--text); font-size: 22px; font-weight: 550; }
.trip-toolbar { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 22px; }
.trip-toolbar .el-input { width: min(190px, 100%); }
.trip-toolbar .el-date-editor { width: 170px; }
.trip-toolbar .el-select { width: 145px; }
.trip-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; min-height: 180px; }
.trip-grid.is-loading { min-height: 260px; }
.trip-grid > .el-empty { grid-column: 1 / -1; }
.trip-card { display: flex; min-width: 0; flex-direction: column; padding: 18px 18px 0; border: 1px solid #cbd3df; border-radius: 6px; background: var(--surface); }
.trip-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.trip-route { min-width: 0; }
.trip-route h2 { margin: 0; color: var(--text); font-size: 16px; font-weight: 550; line-height: 1.5; overflow-wrap: anywhere; }
.trip-route h2 span { padding: 0 5px; color: #8792a4; }
.trip-route p { display: flex; align-items: center; gap: 6px; margin: 7px 0 0; color: var(--text-muted); font-size: 12px; }
.trip-card-head > .el-tag { flex-shrink: 0; }
.trip-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 8px 0 10px; margin-top: 7px; border-top: 1px solid #edf0f4; color: var(--text-muted); font-size: 11px; }
.trip-meta b { color: #687386; font-weight: 400; overflow-wrap: anywhere; }
.trip-meta .el-tag { margin-left: 5px; vertical-align: middle; }
.booking-section { padding: 11px 0 5px; border-top: 1px solid #edf0f4; }
.booking-heading { display: flex; align-items: center; justify-content: space-between; color: var(--text-muted); font-size: 11px; }
.booking-heading strong { display: inline-flex; align-items: center; gap: 6px; color: var(--text); font-size: 12px; font-weight: 500; }
.booking-list { margin-top: 3px; }
.booking-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f2f5; }
.booking-row:last-child { border-bottom: 0; }
.booking-main { display: flex; min-width: 0; align-items: flex-start; gap: 9px; }
.booking-kind { flex-shrink: 0; min-width: 64px; padding: 4px 6px; border-radius: 3px; background: #f0f3f7; color: #53627a; font-size: 10px; text-align: center; }
.booking-info { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.booking-info strong { overflow: hidden; color: #3d485b; font-size: 12px; font-weight: 450; text-overflow: ellipsis; white-space: nowrap; }
.booking-info small { color: #8993a3; font-size: 10px; line-height: 1.5; }
.booking-side { display: flex; flex-shrink: 0; align-items: flex-end; flex-direction: column; gap: 4px; }
.booking-side .el-button { margin-left: 0; padding: 0; font-size: 11px; }
.booking-amount { color: #58657a; font-size: 10px; }
.booking-message { margin: 11px 0 7px; color: #8993a3; font-size: 11px; }
.error-message { color: #a3564f; }
.error-message button { padding: 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font: inherit; }
.trip-card-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-height: 54px; margin-top: auto; border-top: 1px solid #dfe4ec; }
.trip-card-foot .el-button + .el-button { margin-left: 0; }
.detail-button { border-color: #cbd7ef; background: #f3f6fc; color: #315eca; }
.detail-button:hover { border-color: #9bb1e2; background: #e9effc; color: #274ba2; }
.cancel-button { border-color: #f0c5c1; background: #fff7f6; color: #b4544d; }
.cancel-button:hover { border-color: #df9d96; background: #fff0ee; color: #963d37; }
.trip-page > .el-pagination { justify-content: flex-end; margin-top: 20px; }
.trip-detail-status { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; }
.trip-detail-status > div { display: flex; align-items: center; gap: 9px; }
.trip-detail-status > div > span { color: var(--text-muted); font-size: 12px; }
:deep(.el-descriptions__label) { width: 112px; }
.drawer-bookings { margin-top: 24px; }
.drawer-bookings h3 { display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--line); color: var(--text); font-size: 13px; font-weight: 500; }
.drawer-bookings h3 span { color: var(--text-muted); font-size: 11px; font-weight: 400; }
:deep(.booking-detail-dialog) { max-height: calc(100vh - 32px); overflow: auto; border-radius: 8px; }
:deep(.booking-detail-dialog .el-dialog__body) { padding: 0 24px 22px; }
.booking-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 2px 0 18px; }
.booking-detail-kind { color: var(--accent); font-size: 12px; }
.booking-detail-head h2 { margin: 7px 0 4px; color: var(--text); font-size: 19px; font-weight: 550; }
.booking-detail-head p { margin: 0; color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }
.booking-detail-head > .el-tag { flex-shrink: 0; }
.booking-detail-amount { display: flex; align-items: center; justify-content: space-between; padding: 15px 16px; margin-bottom: 16px; border: 1px solid #dce4f2; border-radius: 6px; background: #f6f8fc; }
.booking-detail-amount span { color: var(--text-muted); font-size: 12px; }
.booking-detail-amount strong { color: #315eca; font-size: 20px; font-weight: 600; }
.booking-extra-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 22px; padding: 15px 16px; margin: 16px 0 0; border: 1px solid var(--line); border-radius: 6px; }
.booking-extra-details div { min-width: 0; }
.booking-extra-details dt { margin-bottom: 5px; color: var(--text-muted); font-size: 11px; }
.booking-extra-details dd { margin: 0; color: var(--text); font-size: 12px; overflow-wrap: anywhere; }
.booking-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.booking-dialog-actions .el-button + .el-button { margin-left: 0; }
@media (max-width: 1050px) { .trip-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .trip-grid { grid-template-columns: minmax(0, 1fr); }
  .trip-overview { align-items: flex-start; flex-direction: column; gap: 4px; }
  .trip-toolbar { align-items: stretch; }
  .trip-toolbar .el-input, .trip-toolbar .el-date-editor { width: 100%; }
  .trip-toolbar .el-select { flex: 1; width: auto; }
  .trip-toolbar .el-button { flex: 1; margin-left: 0; }
  .trip-card { padding: 15px 14px 0; }
  .booking-row { align-items: flex-start; }
  .booking-side { align-items: flex-end; }
  .booking-extra-details { grid-template-columns: minmax(0, 1fr); }
  :deep(.booking-detail-dialog .el-dialog__body) { padding: 0 16px 18px; }
  .trip-page > .el-pagination { justify-content: center; overflow-x: auto; }
}
</style>
