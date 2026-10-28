<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Check, CircleCheck, Promotion } from '@element-plus/icons-vue'
import type { AskUserField, AskUserPrompt as AskUserPromptData } from '@/types/conversation'

const props = defineProps<{ prompt: AskUserPromptData; submitted?: boolean }>()
const emit = defineEmits<{ submit: [value: unknown, display: string] }>()
const textValue = ref(defaultText(props.prompt.default_value))
const selected = ref<string | string[] | boolean | null>(props.prompt.ui_type === 'confirm' && typeof props.prompt.default_value !== 'boolean' ? null : defaultSelect(props.prompt.default_value))
const formValues = reactive<Record<string, string | number>>({})
const otherValue = ref('')
const error = ref('')
const uiType = computed(() => props.prompt.ui_type || 'text')
const options = computed(() => Array.isArray(props.prompt.options) ? props.prompt.options.filter((item): item is string => typeof item === 'string') : [])
const fields = computed<AskUserField[]>(() => Array.isArray(props.prompt.fields) ? props.prompt.fields.filter((field): field is AskUserField => Boolean(field && typeof field.name === 'string' && typeof field.label === 'string')) : [])

watch(fields, (nextFields) => {
  for (const key of Object.keys(formValues)) delete formValues[key]
  const defaults = props.prompt.default_value && typeof props.prompt.default_value === 'object' && !Array.isArray(props.prompt.default_value)
    ? props.prompt.default_value as Record<string, unknown>
    : {}
  for (const field of nextFields) {
    const value = defaults[field.name]
    if (typeof value === 'string' || typeof value === 'number') formValues[field.name] = value
  }
}, { immediate: true })

function defaultText(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : '' }
function defaultSelect(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? value : '' }
function labelFor(name: string) { return fields.value.find((field) => field.name === name)?.label || name }
function isOther(value: unknown) { return value === '__other__' }
function displayValue(value: unknown) {
  if (uiType.value === 'form' && value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => labelFor(key) + '：' + String(item)).join('；')
  if (Array.isArray(value)) return value.join('、')
  return String(value)
}
function submit() {
  error.value = ''
  let value: unknown
  if (uiType.value === 'form') {
    const missing = fields.value.find((field) => field.required && (formValues[field.name] === undefined || String(formValues[field.name]).trim() === ''))
    if (missing) { error.value = '请填写' + missing.label; return }
    value = Object.fromEntries(Object.entries(formValues).filter(([, fieldValue]) => String(fieldValue).trim() !== ''))
    if (!Object.keys(value as Record<string, unknown>).length) { error.value = '请至少填写一项'; return }
    for (const field of fields.value) {
      if (field.type === 'number' && formValues[field.name] !== undefined && formValues[field.name] !== '') {
        const number = Number(formValues[field.name])
        if (!Number.isFinite(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
          error.value = `请检查${field.label}的数值范围`
          return
        }
        ;(value as Record<string, unknown>)[field.name] = number
      }
    }
  } else if (uiType.value === 'select') {
    value = isOther(selected.value) ? otherValue.value.trim() : selected.value
    if (!value) { error.value = '请选择一项'; return }
  } else if (uiType.value === 'multi_select') {
    const values = Array.isArray(selected.value) ? selected.value.filter((item) => !isOther(item)) : []
    if (Array.isArray(selected.value) && selected.value.includes('__other__')) values.push(otherValue.value.trim())
    if (!values.length || values.some((item) => !item)) { error.value = '请至少选择一项'; return }
    value = values
  } else if (uiType.value === 'confirm') {
    if (typeof selected.value !== 'boolean') { error.value = '请选择是否确认'; return }
    value = selected.value
  }
  else value = textValue.value.trim()
  if (value === '' || value === undefined || value === null) { error.value = '请填写后再提交'; return }
  emit('submit', value, displayValue(value))
}
</script>

<template>
  <section class="ask-card" :class="{ submitted }" aria-label="需要你的补充信息">
    <div class="ask-heading"><span class="ask-icon"><el-icon><CircleCheck /></el-icon></span><div><strong>请确认或补充信息</strong><p>{{ prompt.question || '请补充以下信息' }}</p></div></div>
    <fieldset v-if="uiType === 'select' || uiType === 'multi_select'" class="ask-options" :disabled="submitted"><legend class="sr-only">{{ prompt.question }}</legend><label v-for="option in options" :key="option" class="ask-option"><input v-model="selected" :type="uiType === 'select' ? 'radio' : 'checkbox'" :value="option" :name="'ask-' + prompt.question" /><span>{{ option }}</span></label><label v-if="prompt.allow_other" class="ask-option"><input v-model="selected" :type="uiType === 'select' ? 'radio' : 'checkbox'" value="__other__" :name="'ask-' + prompt.question" /><span>其他</span></label><input v-if="prompt.allow_other && (isOther(selected) || (Array.isArray(selected) && selected.includes('__other__')))" v-model="otherValue" class="ask-other" type="text" placeholder="请输入其他内容" /></fieldset>
    <div v-else-if="uiType === 'confirm'" class="confirm-options"><button type="button" :class="{ selected: selected === true }" :disabled="submitted" @click="selected = true"><el-icon><Check /></el-icon>确认</button><button type="button" :class="{ selected: selected === false }" :disabled="submitted" @click="selected = false">暂不确认</button></div>
    <div v-else-if="uiType === 'form'" class="ask-form">
      <label v-for="field in fields" :key="field.name" class="ask-field">
        <span>{{ field.label }}<i v-if="field.required" aria-hidden="true">*</i></span>
        <select v-if="field.type === 'select'" v-model="formValues[field.name]" :disabled="submitted" :required="field.required" :aria-label="field.label">
          <option value="">{{ field.placeholder || '请选择' }}</option>
          <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
        </select>
        <textarea v-else-if="field.type === 'textarea'" v-model="formValues[field.name]" :disabled="submitted" :placeholder="field.placeholder" :required="field.required" :aria-label="field.label" rows="2" />
        <input v-else v-model="formValues[field.name]" :disabled="submitted" :type="field.type || 'text'" :min="field.min" :max="field.max" :step="field.step" :placeholder="field.placeholder" :required="field.required" :aria-label="field.label" />
      </label>
    </div>
    <textarea v-else-if="uiType === 'text'" v-model="textValue" :disabled="submitted" class="ask-textarea" rows="3" placeholder="请输入你的补充信息" />
    <input v-else v-model="textValue" :disabled="submitted" class="ask-input" :type="uiType === 'date' ? 'date' : uiType === 'number' ? 'number' : 'text'" :placeholder="uiType === 'date' ? '请选择日期' : '请输入内容'" />
    <p v-if="error" class="ask-error" role="alert">{{ error }}</p>
    <div class="ask-actions"><span v-if="submitted" class="submitted-label"><el-icon><Check /></el-icon>已提交</span><button v-else type="button" class="ask-submit" @click="submit"><el-icon><Promotion /></el-icon>提交回答</button></div>
  </section>
</template>

<style scoped>
.ask-card { max-width: 620px; margin-top: 17px; padding: 17px; border: 1px solid #dfe5ef; border-radius: 9px; background: #fbfcfe; }.ask-card.submitted { background: #f6faf8; border-color: #dce9e1; }
.ask-heading { display: flex; align-items: flex-start; gap: 10px; }.ask-icon { display: grid; flex: 0 0 27px; width: 27px; height: 27px; place-items: center; border-radius: 7px; background: #eaf0fd; color: var(--accent); }.ask-heading strong { display: block; color: var(--text); font-size: 13px; font-weight: 600; }.ask-heading p { margin: 5px 0 0; color: #566278; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
.ask-options { display: grid; gap: 7px; padding: 0; margin: 16px 0 0; border: 0; }.ask-option { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: white; color: #4e5b70; font-size: 13px; cursor: pointer; }.ask-option:has(input:checked) { border-color: #9bb2e7; background: #f1f5ff; color: var(--accent); }.ask-option input { accent-color: var(--accent); }.ask-other { width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; outline: 0; font-size: 12px; }.ask-other:focus, .ask-input:focus, .ask-textarea:focus, .ask-field input:focus, .ask-field select:focus, .ask-field textarea:focus { border-color: #91a9df; box-shadow: 0 0 0 2px #315eca12; }
.confirm-options { display: flex; gap: 8px; margin-top: 16px; }.confirm-options button { padding: 9px 15px; border: 1px solid var(--line); border-radius: 6px; background: white; color: #5c687b; cursor: pointer; font-size: 12px; }.confirm-options button.selected { border-color: #9bb2e7; background: #f1f5ff; color: var(--accent); }.ask-textarea, .ask-input, .ask-field input, .ask-field select, .ask-field textarea { width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; outline: 0; background: white; color: var(--text); font-size: 13px; }.ask-textarea { display: block; margin-top: 16px; resize: vertical; line-height: 1.7; }.ask-input { margin-top: 16px; }.ask-form { display: grid; gap: 13px; margin-top: 16px; }.ask-field { display: grid; gap: 6px; color: #5c687b; font-size: 12px; }.ask-field i { margin-left: 3px; color: #b25d56; font-style: normal; }.ask-field input, .ask-field select, .ask-field textarea { margin-top: 0; }.ask-error { margin: 10px 0 0; color: #ad514a; font-size: 12px; }.ask-actions { display: flex; justify-content: flex-end; margin-top: 14px; }.ask-submit { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border: 0; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-size: 12px; }.submitted-label { display: inline-flex; align-items: center; gap: 5px; color: #43846e; font-size: 12px; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
@media (max-width: 720px) { .ask-card { padding: 14px; }.ask-heading p { font-size: 12px; } }
</style>
