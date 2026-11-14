<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src?: string | null
  name?: string | null
  size?: number
}>(), { size: 32 })

const imageFailed = ref(false)
const fallback = computed(() => Array.from(props.name?.trim() || 'U')[0]?.toUpperCase() || 'U')

watch(() => props.src, () => { imageFailed.value = false })
</script>

<template>
  <span
    class="user-avatar"
    role="img"
    :aria-label="name?.trim() ? `${name}的头像` : '用户头像'"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img v-if="src && !imageFailed" :src="src" alt="" @error="imageFailed = true" />
    <span v-else aria-hidden="true">{{ fallback }}</span>
  </span>
</template>

<style scoped>
.user-avatar { display: inline-grid; flex: 0 0 auto; overflow: hidden; place-items: center; border: 1px solid #dce2ec; border-radius: 50%; background: #e9edf5; color: #586984; font-size: 12px; font-weight: 600; line-height: 1; }
.user-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
