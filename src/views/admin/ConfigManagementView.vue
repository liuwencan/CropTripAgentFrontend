<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import AdminPageShell from './AdminPageShell.vue'
import { configApi } from '@/api/configApi'
import type { ConfigEntry } from '@/types/admin'
import type { PageResponse } from '@/types/api'

const query = reactive({ pageNo: 1, pageSize: 10, keyword: '' })
const result = ref<PageResponse<ConfigEntry>>({ data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0, success: true })
const loading = ref(false)
const saving = ref(false)
const reloading = ref(false)
const dialog = ref(false)
const error = ref('')
const editing = ref<Partial<ConfigEntry>>({})
async function load() {
  loading.value = true; error.value = ''
  try { result.value = await configApi.query(query) } catch (e) { error.value = e instanceof Error ? e.message : '配置加载失败' } finally { loading.value = false }
}
function search() { query.pageNo = 1; load() }
function open(row?: ConfigEntry) { editing.value = row ? { ...row } : {}; dialog.value = true }
async function save() {
  if (!editing.value.configKey?.trim() || !editing.value.configValue?.trim()) return ElMessage.warning('请填写配置 Key 和值')
  if (saving.value) return
  saving.value = true
  try { await (editing.value.id ? configApi.update(editing.value.id, editing.value) : configApi.save(editing.value)); dialog.value = false; ElMessage.success('保存成功'); load() } catch (e) { ElMessage.error(e instanceof Error ? e.message : '保存失败，请重试') } finally { saving.value = false }
}
async function remove(row: ConfigEntry) {
  try { await ElMessageBox.confirm('确定删除配置 ' + row.configKey + ' 吗？此操作会影响使用该配置的服务。', '删除配置', { type: 'warning', confirmButtonText: '删除配置', cancelButtonText: '取消' }) } catch { return }
  try { await configApi.remove(row.id); ElMessage.success('已删除'); load() } catch (e) { ElMessage.error(e instanceof Error ? e.message : '删除失败，请重试') }
}
async function reload() {
  reloading.value = true
  try { await configApi.reload(); ElMessage.success('配置已重新加载') } catch (e) { ElMessage.error(e instanceof Error ? e.message : '重载失败，请重试') } finally { reloading.value = false }
}
onMounted(load)
</script>

<template>
  <AdminPageShell title="系统配置" description="维护差旅业务配置，修改后可重新加载使配置生效。">
    <template #actions><el-button :icon="Refresh" :loading="reloading" @click="reload">重载配置</el-button><el-button type="primary" :icon="Plus" @click="open()">新增配置</el-button></template>
    <el-card class="admin-data-card"><div class="data-section-heading"><h2>配置列表<span>{{ result.totalCount }} 项配置</span></h2></div><form class="toolbar" @submit.prevent="search"><el-input v-model="query.keyword" :prefix-icon="Search" clearable aria-label="搜索配置 Key" placeholder="搜索配置 Key" @clear="search" /><el-button type="primary" native-type="submit" :loading="loading">查询</el-button></form>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="没有找到相关配置，可调整关键词或新增配置"><el-table-column prop="configKey" label="配置 Key" min-width="210" /><el-table-column prop="configName" label="配置名称" min-width="160" /><el-table-column prop="configValue" label="配置值" min-width="180" show-overflow-tooltip /><el-table-column prop="remark" label="备注" min-width="220" /><el-table-column label="操作" width="125" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="open(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column></el-table><el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" /></el-card>
    <el-dialog v-model="dialog" :title="editing.id ? '编辑配置' : '新增配置'" width="520px" :close-on-click-modal="false"><el-form label-position="top"><el-form-item label="配置 Key" required><el-input v-model="editing.configKey" aria-label="配置 Key" placeholder="例如 travel.hotel.limit" /></el-form-item><el-form-item label="配置名称"><el-input v-model="editing.configName" aria-label="配置名称" placeholder="输入便于识别的配置名称" /></el-form-item><el-form-item label="配置值" required><el-input v-model="editing.configValue" aria-label="配置值" type="textarea" :rows="4" placeholder="请输入配置值" /></el-form-item><el-form-item label="备注"><el-input v-model="editing.remark" aria-label="备注" placeholder="说明配置用途或适用范围" /></el-form-item></el-form><template #footer><el-button :disabled="saving" @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></template></el-dialog>
  </AdminPageShell>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 18px; }.toolbar .el-input { max-width: 300px; }.el-pagination { justify-content: flex-end; margin-top: 18px; }
</style>
