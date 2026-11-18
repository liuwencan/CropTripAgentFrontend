<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { parseAddresses, requestRouting, setRequestRouting } from '@/utils/requestRouting'

const addressText = ref(requestRouting.addresses.join('\n'))
const parsed = computed(() => parseAddresses(addressText.value))
const pollingEnabled = computed(() => requestRouting.enabled)

function parseAndApply() {
  const result = parsed.value
  setRequestRouting({ addresses: result.addresses, enabled: requestRouting.enabled && result.addresses.length > 0 })
  addressText.value = result.addresses.join('\n')
  if (result.invalid.length) {
    ElMessage.warning(`已忽略 ${result.invalid.length} 个无效地址，请检查输入`)
  } else {
    ElMessage.success(`已解析 ${result.addresses.length} 台机器地址`)
  }
}

function togglePolling() {
  if (!requestRouting.enabled && requestRouting.addresses.length === 0) {
    ElMessage.warning('请先解析至少一个机器地址')
    return
  }
  setRequestRouting({ enabled: !requestRouting.enabled })
}
</script>

<template>
  <div class="test-page page-section">
    <header class="test-heading">
      <div>
        <p class="eyebrow">内部工具</p>
        <h1>请求路由测试</h1>
        <p class="intro">配置测试机器地址，观察请求在不同机器之间轮询切换。</p>
      </div>
      <div class="heading-mark" aria-hidden="true"><el-icon><Connection /></el-icon></div>
    </header>

    <section class="test-panel" aria-labelledby="address-title">
      <div class="panel-heading">
        <div>
          <h2 id="address-title">机器地址</h2>
          <p>支持换行、逗号或分号分隔，只接受 http / https 地址。</p>
        </div>
        <span class="address-count">{{ parsed.addresses.length }} 台可用</span>
      </div>
      <textarea v-model="addressText" class="address-input" aria-label="机器地址" placeholder="https://machine-a.example.com\nhttps://machine-b.example.com" spellcheck="false" />
      <div v-if="parsed.invalid.length" class="input-warning" role="status"><el-icon><WarningFilled /></el-icon><span>{{ parsed.invalid.length }} 个地址格式无效，解析时会被忽略</span></div>
      <div class="panel-actions">
        <button class="primary-button" type="button" @click="parseAndApply"><el-icon><Refresh /></el-icon>解析并保存</button>
        <span class="save-note">配置只保存在当前浏览器</span>
      </div>
    </section>

    <section class="routing-row" aria-labelledby="polling-title">
      <div class="routing-copy">
        <h2 id="polling-title">请求轮询</h2>
        <p>{{ pollingEnabled ? '已开启：每次请求按顺序切换到下一台机器。' : '已关闭：请求使用默认服务地址。' }}</p>
      </div>
      <button class="switch-control" :class="{ enabled: pollingEnabled }" role="switch" :aria-checked="pollingEnabled" type="button" @click="togglePolling">
        <span class="switch-thumb" aria-hidden="true" />
        <span>{{ pollingEnabled ? '已开启' : '已关闭' }}</span>
      </button>
    </section>

    <p class="test-footnote">轮询配置会同时作用于普通接口和流式对话请求。</p>
  </div>
</template>

<style scoped>
.test-page { max-width: 860px; }
.test-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 34px; }
.eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 11px; letter-spacing: .08em; }
.test-heading h1 { margin: 0; color: var(--text); font-size: 28px; font-weight: 600; letter-spacing: -.02em; }
.intro { margin: 10px 0 0; color: var(--text-muted); font-size: 14px; line-height: 1.7; }
.heading-mark { display: grid; flex: 0 0 44px; width: 44px; height: 44px; place-items: center; border: 1px solid #d8e1f3; border-radius: 8px; background: #eef2fc; color: var(--accent); font-size: 21px; }
.test-panel { padding: 24px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.panel-heading h2, .routing-copy h2 { margin: 0; color: var(--text); font-size: 16px; font-weight: 600; }
.panel-heading p, .routing-copy p { margin: 7px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.address-count { flex-shrink: 0; padding: 4px 8px; border-radius: 4px; background: #f1f4f8; color: var(--text-muted); font-size: 12px; }
.address-input { display: block; width: 100%; min-height: 150px; padding: 13px 14px; resize: vertical; border: 1px solid #dfe4ec; border-radius: 6px; outline: none; color: var(--text); background: #fbfcfe; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; line-height: 1.75; }
.address-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #315eca14; }
.input-warning { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: #a56b16; font-size: 12px; }
.panel-actions { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
.primary-button { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 13px; border: 1px solid var(--accent); border-radius: 6px; background: var(--accent); color: #fff; cursor: pointer; font-size: 13px; }
.primary-button:hover { background: #274ba2; }
.save-note, .test-footnote { color: var(--text-muted); font-size: 12px; }
.routing-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 16px; padding: 20px 24px; border: 1px solid var(--line); border-radius: 8px; background: #f8faff; }
.switch-control { display: inline-flex; flex-shrink: 0; align-items: center; gap: 9px; min-width: 90px; padding: 4px 10px 4px 5px; border: 1px solid #d6dce6; border-radius: 20px; background: #fff; color: var(--text-muted); cursor: pointer; font-size: 12px; }
.switch-thumb { width: 24px; height: 24px; border-radius: 50%; background: #b6bfcd; transition: transform .18s ease, background .18s ease; }
.switch-control.enabled { border-color: var(--accent); background: var(--accent); color: #fff; }
.switch-control.enabled .switch-thumb { background: #fff; transform: translateX(44px); }
.switch-control.enabled span:last-child { margin-left: -1px; transform: translateX(-25px); }
.test-footnote { margin: 18px 2px 0; }
@media (max-width: 600px) { .page-section.test-page { padding: 24px 18px; }.test-heading { padding-bottom: 24px; }.test-heading h1 { font-size: 24px; }.test-panel, .routing-row { padding: 18px; }.panel-heading, .routing-row { align-items: flex-start; flex-direction: column; }.switch-control { align-self: flex-end; } }
</style>
