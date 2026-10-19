<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import AdminPageShell from './AdminPageShell.vue'
import { userApi } from '@/api/userApi'
import type { User } from '@/types/auth'
import type { PageResponse } from '@/types/api'

const query = reactive({ pageNo: 1, pageSize: 10, keyword: '', role: '' })
const result = ref<PageResponse<User>>({ data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0, success: true })
const loading = ref(false)
const error = ref('')
async function load() {
  loading.value = true; error.value = ''
  try { result.value = await userApi.query(query) } catch (e) { error.value = e instanceof Error ? e.message : '用户加载失败' } finally { loading.value = false }
}
function search() { query.pageNo = 1; load() }
async function reset(row: User) {
  let reason: string
  try {
    const response = await ElMessageBox.prompt('请输入重置 ' + row.username + ' 密码的原因', '重置密码', { inputPlaceholder: '例如：员工申请重置', confirmButtonText: '确认重置', cancelButtonText: '取消', inputValidator: (value) => value.trim() ? true : '请输入原因' })
    reason = response.value
  } catch { return }
  try { await userApi.resetPassword(row.id, reason); ElMessage.success('密码已重置'); load() } catch (e) { ElMessage.error(e instanceof Error ? e.message : '重置失败，请重试') }
}
onMounted(load)
</script>

<template>
  <AdminPageShell title="用户管理" description="管理企业成员账号、查看角色与密码状态。">
    <el-card class="admin-data-card">
      <div class="data-section-heading"><h2>企业成员<span>{{ result.totalCount }} 个账号</span></h2></div>
      <form class="toolbar" @submit.prevent="search"><el-input v-model="query.keyword" :prefix-icon="Search" clearable aria-label="搜索企业账号" placeholder="搜索企业账号" @clear="search" /><el-select v-model="query.role" clearable aria-label="筛选角色" placeholder="全部角色" @change="search"><el-option label="普通用户" value="USER" /><el-option label="管理员" value="ADMIN" /></el-select><el-button type="primary" native-type="submit" :loading="loading">查询</el-button></form>
      <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
      <el-table v-else v-loading="loading" :data="result.data" row-key="id" empty-text="没有找到符合条件的企业账号"><el-table-column prop="username" label="企业账号" min-width="180"><template #default="{ row }"><span class="table-account"><span class="table-avatar">{{ row.username.slice(0, 1).toUpperCase() }}</span>{{ row.username }}</span></template></el-table-column><el-table-column prop="role" label="账号角色" width="140"><template #default="{ row }"><el-tag :type="row.role === 'ADMIN' ? 'primary' : 'info'" effect="plain" size="small">{{ row.role === 'ADMIN' ? '管理员' : '普通用户' }}</el-tag></template></el-table-column><el-table-column prop="mustChangePassword" label="密码状态" width="140"><template #default="{ row }"><span class="table-status" :class="{ warning: row.mustChangePassword }"><i />{{ row.mustChangePassword ? '需修改密码' : '正常' }}</span></template></el-table-column><el-table-column prop="createTime" label="创建时间" min-width="180" /><el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="reset(row)">重置密码</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" />
    </el-card>
  </AdminPageShell>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 18px; }.toolbar .el-input { max-width: 260px; }.toolbar .el-select { width: 150px; }.el-pagination { justify-content: flex-end; margin-top: 18px; }
.table-account { display: flex; align-items: center; gap: 10px; color: var(--text); }.table-avatar { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; background: #eef1f6; color: #77849a; font-size: 11px; }
.table-status { display: inline-flex; align-items: center; gap: 7px; color: #667589; font-size: 12px; }.table-status i { width: 5px; height: 5px; border-radius: 50%; background: #669583; }.table-status.warning { color: #9a783b; }.table-status.warning i { background: #b49257; }
@media (max-width: 600px) { .toolbar { flex-wrap: wrap; }.toolbar .el-input { max-width: none; flex: 1 1 100%; }.toolbar .el-select { flex: 1; } }
</style>
