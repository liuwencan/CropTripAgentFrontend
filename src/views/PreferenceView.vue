<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, InfoFilled, Refresh } from '@element-plus/icons-vue'
import PageShell from '@/components/PageShell.vue'
import { preferenceApi } from '@/api/preferenceApi'
import type { PreferenceCategory, PreferenceFieldType, PreferenceValues } from '@/types/preference'
import { getErrorMessage } from '@/utils/errors'

const categories = ref<PreferenceCategory[]>([])
const draft = reactive<PreferenceValues>({})
const saved = ref<PreferenceValues>({})
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const activeCategory = ref('')
const dirty = computed(() => JSON.stringify(normalizeDraft()) !== JSON.stringify(normalizeSaved()))
const visibleCategories = computed(() => activeCategory.value ? categories.value.filter((category) => category.category === activeCategory.value) : categories.value)

/** 只保留有值的字段并统一排序，便于与已保存值比较差异。 */
function normalizeDraft(): PreferenceValues {
  const values: PreferenceValues = {}
  for (const key of Object.keys(draft).sort()) {
    const value = draft[key]
    if (typeof value === 'string' && value.trim()) values[key] = value
    else if (Array.isArray(value) && value.length) values[key] = [...value].sort()
  }
  return values
}

function normalizeSaved(): PreferenceValues {
  const values: PreferenceValues = {}
  for (const key of Object.keys(saved.value).sort()) {
    const value = saved.value[key]
    if (typeof value === 'string' && value.trim()) values[key] = value
    else if (Array.isArray(value) && value.length) values[key] = [...value].sort()
  }
  return values
}

/** 将接口返回的偏好值填入草稿，过滤掉选项之外的历史脏值。 */
function applyPreferences(preferences: PreferenceValues | undefined) {
  const definitions = new Map(categories.value.flatMap((category) => category.items.map((item) => [item.key, item])))
  const next: PreferenceValues = {}
  for (const [key, value] of Object.entries(preferences || {})) {
    const definition = definitions.get(key)
    if (!definition) continue
    if (definition.type === 'single') {
      if (typeof value === 'string' && definition.options.includes(value)) next[key] = value
      continue
    }
    const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && definition.options.includes(item)) : []
    if (values.length) next[key] = [...new Set(values)]
  }
  saved.value = next
  for (const key of Object.keys(draft)) delete draft[key]
  Object.assign(draft, structuredClone(next))
}

function isSelected(key: string, value: string) {
  const current = draft[key]
  return Array.isArray(current) ? current.includes(value) : current === value
}

function isNoPreference(value: string) {
  return value === '无偏好' || value === '无特殊要求'
}

/** 单选再次点击可取消；多选中「无偏好」与具体选项互斥，避免保存出语义冲突的组合。 */
function toggleOption(key: string, type: PreferenceFieldType, value: string) {
  if (type === 'single') {
    draft[key] = draft[key] === value ? '' : value
    return
  }
  const current = Array.isArray(draft[key]) ? [...draft[key] as string[]] : []
  if (isNoPreference(value)) {
    draft[key] = current.includes(value) ? [] : [value]
    return
  }
  const next = current.filter((item) => !isNoPreference(item))
  draft[key] = next.includes(value) ? next.filter((item) => item !== value) : [...next, value]
}

function clearField(key: string) {
  delete draft[key]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [options, current] = await Promise.all([preferenceApi.options(), preferenceApi.get()])
    categories.value = options || []
    applyPreferences(current?.preferences)
  } catch (cause) {
    error.value = getErrorMessage(cause, '偏好设置加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  const preferences = normalizeDraft()
  if (!Object.keys(preferences).length) {
    ElMessage.warning('至少需要设置一项差旅偏好')
    return
  }
  saving.value = true
  try {
    const result = await preferenceApi.save(preferences)
    applyPreferences(result?.preferences || preferences)
    ElMessage.success('偏好已保存，后续行程规划会优先参考')
  } catch (cause) {
    ElMessage.error(getErrorMessage(cause, '偏好保存失败，请稍后重试'))
  } finally {
    saving.value = false
  }
}

function reset() {
  applyPreferences(saved.value)
}

onMounted(load)
</script>

<template>
  <PageShell title="偏好设置" description="记录你的差旅习惯，助手在后续行程规划中会优先参考这些偏好。">
    <template #actions>
      <el-button :icon="Refresh" :loading="loading" @click="load">重新读取</el-button>
      <el-button type="primary" :icon="CircleCheck" :loading="saving" :disabled="loading || !!error || !dirty" @click="save">保存偏好</el-button>
    </template>

    <div v-if="error" class="admin-load-error" role="alert"><span>{{ error }}</span><el-button link type="primary" @click="load">重新加载</el-button></div>
    <template v-else>
      <div class="preference-tabs" role="tablist" aria-label="偏好分类">
        <button type="button" role="tab" :aria-selected="!activeCategory" :class="{ active: !activeCategory }" @click="activeCategory = ''">全部</button>
        <button v-for="category in categories" :key="category.category" type="button" role="tab" :aria-selected="activeCategory === category.category" :class="{ active: activeCategory === category.category }" @click="activeCategory = category.category">{{ category.label }}</button>
      </div>

      <div class="preference-note"><el-icon><InfoFilled /></el-icon>单选再次点击可取消；多选可选择多个标签。保存后仅保留后端预置的选项值。</div>

      <div class="preference-grid">
        <el-card v-for="category in visibleCategories" :key="category.category" class="preference-card">
          <template #header><div class="preference-card-title"><h3>{{ category.label }}</h3><span>{{ category.items.filter((item) => draft[item.key] && (Array.isArray(draft[item.key]) ? (draft[item.key] as string[]).length : true)).length }}/{{ category.items.length }} 已设置</span></div></template>
          <div v-for="item in category.items" :key="item.key" class="preference-field">
            <div class="field-heading">
              <label :id="`label-${item.key}`">{{ item.label }}<small>{{ item.type === 'multi' ? '可多选' : '单选' }}</small></label>
              <button v-if="draft[item.key] && (Array.isArray(draft[item.key]) ? (draft[item.key] as string[]).length : true)" type="button" class="field-clear" @click="clearField(item.key)">清除</button>
            </div>
            <div class="option-tags" role="group" :aria-labelledby="`label-${item.key}`">
              <button v-for="option in item.options" :key="option" type="button" class="option-tag" :class="{ selected: isSelected(item.key, option), neutral: isNoPreference(option) }" :aria-pressed="isSelected(item.key, option)" @click="toggleOption(item.key, item.type, option)">{{ option }}</button>
            </div>
          </div>
        </el-card>
      </div>

      <div v-if="dirty" class="preference-save-bar" role="status">
        <span>有未保存的修改</span>
        <div><el-button :disabled="saving" @click="reset">放弃修改</el-button><el-button type="primary" :loading="saving" @click="save">保存偏好</el-button></div>
      </div>
    </template>
  </PageShell>
</template>

<style scoped>
.preference-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.preference-tabs button { padding: 7px 15px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: #5a6577; cursor: pointer; font-size: 12px; }
.preference-tabs button:hover { border-color: #c8d3e8; color: var(--text); }
.preference-tabs button.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 500; }
.preference-note { display: flex; align-items: center; gap: 7px; margin-bottom: 20px; color: var(--text-muted); font-size: 12px; }
.preference-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 18px; align-items: start; }
.preference-card-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.preference-card-title h3 { margin: 0; color: var(--text); font-size: 14px; font-weight: 550; }
.preference-card-title span { color: var(--text-muted); font-size: 11px; }
.preference-field { padding: 16px 0; border-top: 1px solid var(--line); }
.preference-field:first-of-type { padding-top: 0; border-top: 0; }
.preference-field:last-child { padding-bottom: 0; }
.field-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 11px; }
.field-heading label { display: flex; align-items: center; gap: 8px; color: #3d485c; font-size: 13px; }
.field-heading small { padding: 1px 6px; border-radius: 4px; background: var(--sidebar); color: var(--text-muted); font-size: 10px; font-weight: 400; }
.field-clear { padding: 0; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 11px; }
.field-clear:hover { color: var(--accent); }
.option-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.option-tag { padding: 6px 12px; border: 1px solid #e0e5ed; border-radius: 6px; background: #fff; color: #55617a; cursor: pointer; font-size: 12px; line-height: 1.5; transition: border-color .15s, background .15s, color .15s; }
.option-tag:hover { border-color: #b9c8e6; color: var(--text); }
.option-tag.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 500; }
.option-tag.neutral.selected { border-color: #c3cad4; background: #f2f4f7; color: #505c70; font-weight: 400; }
.preference-save-bar { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; padding: 13px 18px; border: 1px solid var(--line); border-radius: 8px; background: #fffffff2; box-shadow: 0 -6px 24px #25304412; color: var(--text-muted); font-size: 13px; backdrop-filter: blur(6px); }
.preference-save-bar > div { display: flex; gap: 10px; }
.preference-save-bar :deep(.el-button + .el-button) { margin-left: 0; }
@media (max-width: 900px) { .preference-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 600px) { .preference-save-bar { flex-direction: column; align-items: stretch; }.preference-save-bar > div { justify-content: flex-end; } }
</style>
