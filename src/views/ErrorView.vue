<template><div class="page-section"><el-result icon="error" title="页面加载失败" sub-title="可以刷新页面，或返回差旅工作台"><template #extra><el-button type="primary" @click="location.reload()">刷新页面</el-button><el-button @click="$router.push('/workspace')">返回工作台</el-button></template></el-result></div></template>
<script setup lang="ts">const location = window.location</script>
