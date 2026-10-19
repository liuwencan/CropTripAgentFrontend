<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import AdminPageShell from './AdminPageShell.vue'
import { promptApi } from '@/api/promptApi'
import type { PromptEntry, PromptVersion, PromptReleaseLog, PromptVersionCompare } from '@/types/admin'
import type { PageResponse } from '@/types/api'

const query = reactive({ pageNo: 1, pageSize: 10, keyword: '' })
const result = ref<PageResponse<PromptEntry>>({ data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0, success: true })
const versions = ref<PromptVersion[]>([])
const logs = ref<PromptReleaseLog[]>([])
const selected = ref<PromptEntry>()
const compareResult = ref<PromptVersionCompare>()
const loading = ref(false)
const detailLoading = ref(false)
const operating = ref(false)
const error = ref('')
const detailError = ref('')
let selectionRequest = 0
const statusLabels: Record<string, string> = { PUBLISHED: '已发布', ACTIVE: '已启用', DRAFT: '草稿', OFFLINE: '已下线', ARCHIVED: '已归档' }
const operationLabels: Record<string, string> = { PUBLISH: '发布', OFFLINE: '下线', ROLLBACK: '回滚' }
async function load() {
  loading.value = true; error.value = ''
  try { result.value = await promptApi.query(query) } catch (e) { error.value = e instanceof Error ? e.message : 'Prompt 加载失败' } finally { loading.value = false }
}
function search() { query.pageNo = 1; load() }
async function select(row: PromptEntry) {
  const request = ++selectionRequest
  selected.value = row; versions.value = []; logs.value = []; compareResult.value = undefined; detailError.value = ''; detailLoading.value = true
  try {
    const [nextVersions, nextLogs] = await Promise.all([promptApi.versions(row.id), promptApi.releaseLogs(row.id)])
    if (request === selectionRequest) { versions.value = nextVersions; logs.value = nextLogs }
  } catch (e) { if (request === selectionRequest) detailError.value = e instanceof Error ? e.message : '版本加载失败' } finally { if (request === selectionRequest) detailLoading.value = false }
}
async function operate(kind: 'publish' | 'offline' | 'rollback', version?: PromptVersion) {
  if (!selected.value || operating.value) return
  const row = selected.value
  const title = { publish: '发布 Prompt', offline: '下线 Prompt', rollback: '回滚 Prompt' }[kind]
  let reason: string
  try {
    const response = await ElMessageBox.prompt('请输入' + title.slice(0, 2) + '原因，便于后续审计。', title, { confirmButtonText: '确认' + title.slice(0, 2), cancelButtonText: '取消', inputValidator: (value) => value.trim() ? true : '请输入原因' })
    reason = response.value
  } catch { return }
  operating.value = true
  try {
    if (kind === 'publish' && version) await promptApi.publish(row.id, version.id, reason)
    else if (kind === 'rollback' && version) await promptApi.rollback(row.id, version.id, reason)
    else if (kind === 'offline') await promptApi.offline(row.id, reason)
    ElMessage.success(title.slice(0, 2) + '成功')
    await load()
    if (selected.value?.id === row.id) await select(result.value.data.find((item) => item.id === row.id) || row)
  } catch (e) { ElMessage.error(e instanceof Error ? e.message : '操作失败，请重试') } finally { operating.value = false }
}
async function compare() {
  if (!selected.value || versions.value.length < 2) return
  const row = selected.value
  const [left, right] = versions.value
  try {
    const response = await promptApi.compare(row.id, left.id, right.id)
    if (selected.value?.id === row.id) compareResult.value = response
  } catch (e) { ElMessage.error(e instanceof Error ? e.message : '版本比较失败，请重试') }
}
onMounted(load)
</script>

<template>
  <AdminPageShell title="Prompt 管理" description="维护助手提示词，管理版本发布与变更记录。">
    <el-card class="admin-data-card"><div class="data-section-heading"><h2>提示词列表<span>{{ result.totalCount }} 个提示词</span></h2></div><form class="toolbar" @submit.prevent="search"><el-input v-model="query.keyword" :prefix-icon="Search" clearable aria-label="搜索 Prompt" placeholder="搜索提示词名称或 Key" @clear="search" /><el-button type="primary" native-type="submit" :loading="loading">查询</el-button></form>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="没有找到相关提示词，请调整搜索关键词"><el-table-column prop="promptName" label="提示词名称" min-width="180" /><el-table-column prop="promptKey" label="Key" min-width="170" /><el-table-column prop="agentCapability" label="适用能力" min-width="140" /><el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><el-tag :type="['PUBLISHED', 'ACTIVE'].includes(row.status) ? 'success' : 'info'" effect="plain" size="small">{{ statusLabels[row.status] || row.status || '未设置' }}</el-tag></template></el-table-column><el-table-column prop="updateTime" label="更新时间" min-width="175" /><el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="select(row)">查看版本</el-button></template></el-table-column></el-table><el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" /></el-card>
    <el-card v-if="selected" v-loading="detailLoading" class="version-card">
      <template #header><div class="version-header"><div><h2>{{ selected.promptName }}</h2><p>版本与发布记录</p></div><div class="version-actions"><el-button :disabled="versions.length < 2 || operating" @click="compare">比较最近版本</el-button><el-button :disabled="operating" @click="operate('offline')">下线</el-button><el-button text @click="selected = undefined; selectionRequest++">关闭</el-button></div></div></template>
      <div v-if="detailError" class="admin-load-error" role="alert"><span>{{ detailError }}</span><el-button link type="primary" @click="select(selected)">重新加载</el-button></div>
      <template v-else>
        <el-empty v-if="!detailLoading && !versions.length" description="暂无版本，请先在服务端创建提示词版本" :image-size="64" />
        <div v-for="version in versions" :key="version.id" class="version-row"><div><strong>v{{ version.versionNo }}</strong><el-tag size="small" :type="version.current ? 'success' : 'info'" effect="plain">{{ version.current ? '当前版本' : (statusLabels[version.versionStatus || 'DRAFT'] || version.versionStatus) }}</el-tag><p>{{ version.changeReason || '暂无变更说明' }}</p></div><div class="version-row-actions"><el-button v-if="!version.current" :disabled="operating" type="primary" plain @click="operate('publish', version)">发布</el-button><el-button v-if="!version.current" :disabled="operating" text @click="operate('rollback', version)">回滚</el-button></div></div>
        <div v-if="logs.length" class="audit-section"><h3>发布审计</h3><div v-for="log in logs" :key="log.id" class="audit-row"><span>{{ operationLabels[log.operationType] || log.operationType }}</span><span>{{ log.operationReason || log.failureReason || '未填写原因' }}</span><time>{{ log.createTime || '暂无时间' }}</time></div></div>
        <div v-if="compareResult" class="compare-grid"><div><h3>版本 {{ compareResult.leftVersionId }}</h3><pre>{{ compareResult.leftPromptContent }}</pre></div><div><h3>版本 {{ compareResult.rightVersionId }}</h3><pre>{{ compareResult.rightPromptContent }}</pre></div></div>
      </template>
    </el-card>
  </AdminPageShell>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 18px; }.toolbar .el-input { max-width: 300px; }.el-pagination { justify-content: flex-end; margin-top: 18px; }
.version-card { margin-top: 24px; }.version-header, .version-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.version-header h2 { margin: 0; font-size: 15px; font-weight: 500; }.version-header p { margin: 7px 0 0; color: var(--text-muted); font-size: 12px; }
.version-actions, .version-row-actions { display: flex; flex-shrink: 0; gap: 6px; }.version-actions .el-button + .el-button, .version-row-actions .el-button + .el-button { margin-left: 0; }
.version-row { padding: 18px 0; border-bottom: 1px solid var(--line); }.version-row strong { margin-right: 12px; color: var(--text); font-weight: 500; }.version-row p { margin: 9px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.8; }
.audit-section { margin-top: 28px; }.audit-section h3, .compare-grid h3 { margin: 0 0 12px; color: var(--text); font-size: 13px; font-weight: 500; }
.audit-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 160px; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); color: var(--text-muted); font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.compare-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 28px; }.compare-grid pre { max-height: 280px; overflow: auto; padding: 16px; border: 1px solid var(--line); border-radius: 6px; background: var(--sidebar); color: var(--text); font: inherit; font-size: 12px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 900px) { .version-header { align-items: flex-start; flex-direction: column; }.version-actions { flex-wrap: wrap; } }
@media (max-width: 700px) { .compare-grid { grid-template-columns: 1fr; }.audit-row { grid-template-columns: 1fr; gap: 4px; }.version-row { align-items: flex-start; }.version-row-actions { flex-wrap: wrap; flex-shrink: 1; } }
</style>
