<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'

defineProps<{ eyebrow?: string; title: string; description: string }>()
</script>

<template>
  <PageShell :title="title" :description="description">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <slot />
  </PageShell>
</template>
