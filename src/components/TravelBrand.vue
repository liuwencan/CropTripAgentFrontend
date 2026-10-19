<script setup lang="ts">
defineProps<{ compact?: boolean; markOnly?: boolean }>()
</script>

<template>
  <span class="travel-brand">
    <svg class="travel-mark" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" /><path d="M8.5 21.5 13 17l-2.5-5.5 2-2L17 14l5.5-5.5 1 1L19 16l4.5 4.5-2 2L16 20l-4.5 4.5-3-3Z" fill="white" /></svg>
    <span v-if="!markOnly" class="brand-name" :class="{ compact }">企业差旅<span class="brand-subtitle">智能助手</span></span>
  </span>
</template>

<style scoped>
.travel-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--accent); white-space: nowrap; }
.travel-mark { flex-shrink: 0; }
.brand-name { color: var(--text); font-size: 16px; font-weight: 650; letter-spacing: .01em; }
.brand-subtitle { display: block; margin-top: 3px; color: var(--text-muted); font-size: 10px; letter-spacing: .08em; font-weight: 400; }
.compact { display: none; }
@media (max-width: 720px) { .compact { display: block; } }
</style>
