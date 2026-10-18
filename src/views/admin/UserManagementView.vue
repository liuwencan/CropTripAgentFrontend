<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminPageShell from './AdminPageShell.vue'
import { userApi } from '@/api/userApi'
import type { User } from '@/types/auth'
import type { PageResponse } from '@/types/api'

const query = reactive({ pageNo: 1, pageSize: 10, keyword: '', role: '' })
const result = ref<PageResponse<User>>({ data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0, success: true })
const loading = ref(false)
async function load() { loading.value = true; try { result.value = await userApi.query(query) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '用户加载失败') } finally { loading.value = false } }
async function reset(row: User) { const reason = await ElMessageBox.prompt(`请输入重置 ${row.username} 的原因`, '重置密码', { inputPlaceholder: '例如：员工申请重置', inputValidator: (value) => value.trim() ? true : '请输入原因' }); await userApi.resetPassword(row.id, reason.value); ElMessage.success('密码已重置'); }
onMounted(load)
</script>
<template><AdminPageShell eyebrow="ADMINISTRATION" title="用户管理" description="查看企业账号状态，并处理必要的账号维护。"><el-card><div class="toolbar"><el-input v-model="query.keyword" clearable placeholder="搜索账号" @keyup.enter="query.pageNo = 1; load()" /><el-select v-model="query.role" clearable placeholder="全部角色" @change="query.pageNo = 1; load()"><el-option label="普通用户" value="USER" /><el-option label="管理员" value="ADMIN" /></el-select><el-button type="primary" @click="load">查询</el-button></div><el-table v-loading="loading" :data="result.data" row-key="id"><el-table-column prop="username" label="账号" min-width="150" /><el-table-column prop="role" label="角色" width="120" /><el-table-column prop="mustChangePassword" label="需改密" width="100"><template #default="{ row }"><el-tag :type="row.mustChangePassword ? 'warning' : 'success'" size="small">{{ row.mustChangePassword ? '是' : '否' }}</el-tag></template></el-table-column><el-table-column prop="createTime" label="创建时间" min-width="170" /><el-table-column label="操作" width="120"><template #default="{ row }"><el-button link type="primary" @click="reset(row)">重置密码</el-button></template></el-table-column></el-table><el-pagination v-model:current-page="query.pageNo" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="result.totalCount" @current-change="load" /></el-card></AdminPageShell></template>
<style scoped>.toolbar { display: flex; gap: 10px; margin-bottom: 18px; }.toolbar .el-input { max-width: 240px; }.toolbar .el-select { width: 150px; }.el-pagination { justify-content: flex-end; margin-top: 18px; } @media (max-width: 600px) { .toolbar { flex-wrap: wrap; }.toolbar .el-input { max-width: none; flex: 1 1 100%; } }</style>
