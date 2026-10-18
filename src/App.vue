<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Suspense>
      <component :is="Component" />
      <template #fallback><div class="route-loading">正在加载工作台…</div></template>
    </Suspense>
  </RouterView>
</template>

<style scoped>.route-loading { display: grid; min-height: 100vh; place-items: center; color: #4f6d65; background: #f3f6f5; }</style>
