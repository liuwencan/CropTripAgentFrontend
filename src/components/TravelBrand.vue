<script setup lang="ts">
defineProps<{ compact?: boolean; markOnly?: boolean }>()
</script>

<template>
  <span class="travel-brand">
    <img class="travel-mark" src="/logo.png" alt="" aria-hidden="true" />
    <span v-if="!markOnly" class="brand-name" :class="{ compact }">途灵<span class="brand-subtitle">企业差旅助手</span></span>
  </span>
</template>

<style scoped>
.travel-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--accent); white-space: nowrap; }
.travel-mark { display: block; width: 36px; height: 36px; flex-shrink: 0; object-fit: contain; }
.brand-name { color: var(--text); font-size: 16px; font-weight: 650; letter-spacing: .01em; }
.brand-subtitle { display: block; margin-top: 3px; color: var(--text-muted); font-size: 10px; letter-spacing: .08em; font-weight: 400; }
.compact { display: none; }
@media (max-width: 720px) { .compact { display: block; } }
</style>
