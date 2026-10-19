<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <div v-else class="route-loading" role="status">正在加载工作台…</div>
  </RouterView>
</template>

<style scoped>.route-loading { display: grid; min-height: 100vh; place-items: center; color: var(--text-muted); background: var(--surface); font-size: 13px; }</style>
