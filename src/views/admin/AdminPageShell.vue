<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description: string }>()
</script>
<template><div class="page-section admin-page"><p class="eyebrow">{{ eyebrow }}</p><div class="page-title"><div><h1>{{ title }}</h1><p class="muted">{{ description }}</p></div><slot name="actions" /></div><slot /></div></template>
<style scoped>.eyebrow { margin: 0 0 8px; color: #6f8b86; font-size: 11px; letter-spacing: .16em; }.page-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }.page-title h1 { margin: 0 0 6px; color: #173b38; font-size: 30px; }.admin-page :deep(.el-card) { border-color: #dce7e3; box-shadow: 0 8px 22px rgba(25,69,61,.04); } @media (max-width: 620px) { .page-title { align-items: flex-start; flex-direction: column; } }</style>
