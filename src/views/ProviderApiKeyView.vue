<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import PageShell from '@/components/PageShell.vue'
import { providerApiKeyApi, type ProviderApiKeyPayload } from '@/api/providerApiKeyApi'
import type { ProviderApiKey, ProviderApiKeyStatus } from '@/types/admin'
import type { PageResponse } from '@/types/api'
import { formatDate } from '@/utils/format'

const query = reactive({ pageNo: 1, pageSize: 20, providerCode: '', status: 'ALL' })
const result = ref<PageResponse<ProviderApiKey>>({ data: [], pageNo: 1, pageSize: 20, totalCount: 0, totalPage: 0, success: true })
const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const error = ref('')
const editingId = ref<number>()
const form = reactive<ProviderApiKeyPayload>({ providerCode: '', apiKey: '', status: 'ACTIVE', remark: '' })

const statusLabels: Record<string, string> = { ACTIVE: '已启用', INACTIVE: '已停用', REVOKED: '已撤销' }
const statusTypes: Record<string, 'success' | 'info' | 'danger'> = { ACTIVE: 'success', INACTIVE: 'info', REVOKED: 'danger' }

async function load() {
  loading.value = true
  error.value = ''
  try { result.value = await providerApiKeyApi.query(query) }
  catch (e) { error.value = e instanceof Error ? e.message : 'API Key 加载失败' }
  finally { loading.value = false }
}

function search() { query.pageNo = 1; load() }

function resetForm() {
  editingId.value = undefined
  Object.assign(form, { providerCode: '', apiKey: '', status: 'ACTIVE', remark: '' })
}

async function open(row?: ProviderApiKey) {
  resetForm()
  if (row) {
    editingId.value = row.id
    try {
      const detail = await providerApiKeyApi.get(row.id)
      Object.assign(form, { providerCode: detail.providerCode, status: detail.status as ProviderApiKeyStatus, remark: detail.remark || '' })
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '凭证详情加载失败')
      return
    }
  }
  dialog.value = true
}

async function save() {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(form.providerCode.trim())) return ElMessage.warning('服务商编码仅支持 1 至 32 位字母、数字、下划线或连字符')
  if (!form.apiKey.trim()) return ElMessage.warning('请输入 API Key')
  if (form.apiKey.length > 4096) return ElMessage.warning('API Key 不能超过 4096 个字符')
  if ((form.remark || '').length > 500) return ElMessage.warning('备注不能超过 500 个字符')
  if (saving.value) return
  saving.value = true
  try {
    const payload = { ...form, providerCode: form.providerCode.trim(), apiKey: form.apiKey.trim(), remark: form.remark?.trim() }
    if (editingId.value) await providerApiKeyApi.update(editingId.value, payload)
    else await providerApiKeyApi.create(payload)
    dialog.value = false
    ElMessage.success(editingId.value ? 'API Key 已更新' : 'API Key 已添加')
    await load()
  } catch (e) { ElMessage.error(e instanceof Error ? e.message : '保存失败，请重试') }
  finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <PageShell title="第三方平台 API Key" description="管理当前账号的第三方服务商凭证。密钥由服务端加密保存，页面不会再次显示已保存的密钥。">
    <template #actions><el-button type="primary" :icon="Plus" @click="open()">添加 API Key</el-button></template>
    <el-card class="provider-key-card">
      <div class="data-section-heading"><h2>凭证列表<span>{{ result.totalCount }} 个凭证</span></h2></div>
      <form class="toolbar" @submit.prevent="search">
        <el-input v-model="query.providerCode" :prefix-icon="Search" clearable aria-label="按服务商编码筛选" placeholder="服务商编码" @clear="search" />
        <el-select v-model="query.status" aria-label="按凭证状态筛选" class="status-filter">
          <el-option label="全部状态" value="ALL" /><el-option label="已启用" value="ACTIVE" /><el-option label="已停用" value="INACTIVE" /><el-option label="已撤销" value="REVOKED" />
        </el-select>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :icon="Refresh" aria-label="刷新凭证列表" title="刷新" :loading="loading" @click="load" />
      </form>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="暂无 API Key，可添加一个第三方服务商凭证">
        <el-table-column prop="providerCode" label="服务商编码" min-width="190" />
        <el-table-column label="密钥" min-width="180"><template #default><span class="secret-state">已加密保存</span></template></el-table-column>
        <el-table-column prop="status" label="状态" width="112"><template #default="{ row }"><el-tag :type="statusTypes[row.status] || 'info'" effect="plain" size="small">{{ statusLabels[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column prop="updateTime" label="更新时间" min-width="180"><template #default="{ row }">{{ formatDate(row.updateTime || row.createTime) }}</template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button type="primary" plain @click="open(row)">编辑</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" />
    </el-card>
    <el-dialog v-model="dialog" :title="editingId ? '编辑 / 更换 API Key' : '添加 API Key'" width="520px" :close-on-click-modal="false" @closed="resetForm">
      <el-form label-position="top">
        <el-form-item label="服务商编码" required><el-input v-model="form.providerCode" :disabled="Boolean(editingId)" maxlength="32" aria-label="服务商编码" placeholder="例如 openai、amap" /></el-form-item>
        <el-form-item label="API Key" required><el-input v-model="form.apiKey" type="password" show-password maxlength="4096" autocomplete="new-password" aria-label="API Key" :placeholder="editingId ? '输入新的 API Key 以替换现有密钥' : '输入服务商提供的 API Key'" /></el-form-item>
        <el-form-item label="状态" required><el-select v-model="form.status" aria-label="API Key 状态" style="width: 100%"><el-option label="已启用" value="ACTIVE" /><el-option label="已停用" value="INACTIVE" /><el-option label="已撤销" value="REVOKED" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit aria-label="备注" placeholder="用于标记用途或环境" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存凭证</el-button></template>
    </el-dialog>
  </PageShell>
</template>

<style scoped>
.provider-key-card { border-radius: 6px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.toolbar .el-input { width: min(260px, 100%); }
.status-filter { width: 150px; }
.secret-state { color: #427c66; font-size: 12px; }
.el-pagination { justify-content: flex-end; margin-top: 18px; }
@media (max-width: 720px) {
  .toolbar { align-items: stretch; }
  .toolbar .el-input, .status-filter { width: 100%; }
  .el-pagination { justify-content: flex-start; overflow-x: auto; }
}
</style>
