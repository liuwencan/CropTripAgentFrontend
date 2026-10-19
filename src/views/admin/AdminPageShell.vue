<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description: string }>()
</script>

<template>
  <div class="page-section admin-page">
    <div class="page-title"><div><h1>{{ title }}</h1><p>{{ description }}</p></div><div class="page-actions"><slot name="actions" /></div></div>
    <slot />
  </div>
</template>

<style scoped>
.admin-page { padding-top: 34px; }
.page-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
.page-title h1 { margin: 0 0 10px; color: var(--text); font-size: 26px; font-weight: 550; letter-spacing: -.03em; }
.page-title p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.8; }
.page-actions { display: flex; flex-shrink: 0; gap: 10px; }.page-actions :deep(.el-button + .el-button) { margin-left: 0; }
.admin-page :deep(.el-card) { border-color: var(--line); }
.admin-page :deep(.toolbar) { margin-bottom: 24px; }
.admin-page :deep(.toolbar .el-input) { width: min(300px, 100%); }
.admin-page :deep(.el-pagination) { margin-top: 24px; }
@media (max-width: 720px) { .page-title { align-items: flex-start; flex-direction: column; gap: 18px; }.page-title h1 { font-size: 24px; }.admin-page :deep(.toolbar) { flex-wrap: wrap; }.admin-page :deep(.el-pagination) { justify-content: flex-start; overflow-x: auto; } }
</style>
