<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck } from '@element-plus/icons-vue'
import PageShell from '@/components/PageShell.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { profileApi } from '@/api/profileApi'
import { useAuthStore } from '@/store/auth'
import type { ProfileDraft, ProfileField, ProfileOptions, UserProfile } from '@/types/profile'
import { profileDraft, profilePatch, profileSections, validateProfile } from '@/utils/profile'
import { ApiError, getErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const current = ref<UserProfile>()
const options = ref<ProfileOptions>({ levels: [], genders: [], idTypes: [], editableFields: [] })
const draft = reactive<ProfileDraft>(profileDraft())
const saved = ref<ProfileDraft>(profileDraft())
const errors = ref<Partial<Record<ProfileField, string>>>({})
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const loadError = ref('')
const saveError = ref('')
const formElement = ref<HTMLFormElement>()
const busy = computed(() => loading.value || saving.value || deleting.value)
const patch = computed(() => profilePatch(draft, saved.value, options.value.editableFields))
const dirty = computed(() => Object.keys(patch.value).length > 0)
const hasSavedValues = computed(() => current.value?.profileExists || Boolean(current.value?.account.nickName || current.value?.account.avatar))
const displayName = computed(() => current.value?.account.nickName || current.value?.account.username || '用户')
const sections = computed(() => profileSections.map((section) => ({
  ...section, fields: section.fields.filter((field) => options.value.editableFields.includes(field.key)),
})).filter((section) => section.fields.length))

function apply(data: UserProfile) {
  current.value = data
  saved.value = profileDraft(data)
  Object.assign(draft, saved.value)
  errors.value = {}
  saveError.value = ''
  if (auth.user?.id === data.account.id) auth.user = { ...auth.user, ...data.account }
}

function reset() {
  Object.assign(draft, saved.value)
  errors.value = {}
  saveError.value = ''
}

async function confirmDiscard() {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('有未保存的个人资料，确定放弃这些修改吗？', '放弃修改', { confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning' })
    return true
  } catch { return false }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [definitions, data] = await Promise.all([profileApi.options(), profileApi.get()])
    options.value = definitions
    apply(data)
  } catch (cause) {
    loadError.value = getErrorMessage(cause, '个人资料加载失败，请重新加载')
  } finally { loading.value = false }
}

async function reload() {
  if (busy.value || !await confirmDiscard()) return
  await load()
}

async function save() {
  if (busy.value || loadError.value || !dirty.value) return
  const payload = patch.value
  errors.value = validateProfile(payload, options.value)
  saveError.value = ''
  if (Object.keys(errors.value).length) {
    await nextTick()
    formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  try {
    apply(await (current.value?.profileExists ? profileApi.update(payload) : profileApi.create(payload)))
    ElMessage.success('个人资料已保存')
  } catch (cause) {
    if (cause instanceof ApiError && ['PROFILE_ALREADY_EXISTS', 'RESOURCE_NOT_FOUND'].includes(cause.errorCode || '')) {
      saveError.value = '个人档案状态已变更，请重新读取资料后编辑。'
    } else saveError.value = getErrorMessage(cause, '个人资料保存失败，请重试')
  } finally { saving.value = false }
}

async function clearProfile() {
  if (busy.value || loadError.value) return
  try {
    await ElMessageBox.confirm('将清空昵称、头像、差旅信息、联系方式和证件信息，未保存的修改也会丢弃。账号和密码会保留。确定清空吗？', '清空个人资料', {
      confirmButtonText: '清空资料', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  deleting.value = true
  saveError.value = ''
  try {
    await profileApi.clear()
    if (current.value) apply({ account: { ...current.value.account, nickName: null, avatar: null }, profileExists: false, profile: null })
    ElMessage.success('个人资料已清空')
    await load()
  } catch (cause) { saveError.value = getErrorMessage(cause, '清空资料失败，请重试') }
  finally { deleting.value = false }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || deleting.value) { event.preventDefault(); event.returnValue = '' }
}
onBeforeRouteLeave(async () => {
  if (saving.value || deleting.value) return false
  return confirmDiscard()
})
onMounted(() => { load(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <PageShell class="profile-page" title="个人资料" description="完善个人信息，让每一次差旅安排更顺畅。所有资料均为选填。">
    <template #actions><el-button :disabled="busy" @click="reload">重新读取</el-button></template>
    <div v-if="loading" class="profile-state" role="status">正在加载个人资料…</div>
    <div v-else-if="loadError" class="profile-state" role="alert"><span>{{ loadError }}</span><el-button type="primary" plain @click="load">重新加载</el-button></div>
    <template v-else-if="current">
      <section class="profile-account" aria-label="当前账号">
        <UserAvatar :src="current.account.avatar" :name="displayName" :size="56" />
        <div class="account-summary"><h2>{{ displayName }}</h2><p>账号：{{ current.account.username }}</p></div>
        <span class="account-role">{{ current.account.role.toUpperCase() === 'ADMIN' ? '管理员' : '企业员工' }}</span>
      </section>
      <p v-if="!current.profileExists" class="profile-note">还没有个人档案，填写任意一项资料并保存即可建立。</p>
      <form ref="formElement" class="profile-form" novalidate @submit.prevent="save">
        <fieldset :disabled="busy">
          <section v-for="section in sections" :key="section.title" class="profile-section" :aria-label="section.title">
            <div class="section-intro"><h2>{{ section.title }}</h2><p>{{ section.description }}</p></div>
            <div class="profile-fields">
              <div v-for="field in section.fields" :key="field.key" class="profile-field">
                <label :for="`profile-${field.key}`">{{ field.label }}</label>
                <select v-if="field.options" :id="`profile-${field.key}`" v-model="draft[field.key]" :name="field.key" :aria-invalid="!!errors[field.key]" :aria-describedby="errors[field.key] ? `error-${field.key}` : undefined" @change="delete errors[field.key]">
                  <option value="">未设置</option>
                  <option v-for="option in options[field.options]" :key="option.code" :value="option.code">{{ option.label }}</option>
                </select>
                <input v-else :id="`profile-${field.key}`" v-model="draft[field.key]" :name="field.key" :type="field.key === 'phone' ? 'tel' : field.key === 'email' ? 'email' : field.key === 'avatar' ? 'url' : 'text'" :maxlength="field.maxLength" :placeholder="field.placeholder" autocomplete="off" :spellcheck="false" :aria-invalid="!!errors[field.key]" :aria-describedby="errors[field.key] ? `error-${field.key}` : field.hint ? `hint-${field.key}` : undefined" @input="delete errors[field.key]" />
                <p v-if="errors[field.key]" :id="`error-${field.key}`" class="field-error" role="alert">{{ errors[field.key] }}</p>
                <p v-else-if="field.hint" :id="`hint-${field.key}`" class="field-hint">{{ field.hint }}</p>
              </div>
            </div>
          </section>
        </fieldset>
        <p class="profile-note">将已填写的内容留空并保存，即可清空该项资料。</p>
        <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>
        <div class="profile-save-bar">
          <span role="status">{{ dirty ? '有未保存的修改' : '资料已与当前账号同步' }}</span>
          <div><el-button :disabled="busy || !dirty" @click="reset">放弃修改</el-button><el-button type="primary" native-type="submit" :icon="CircleCheck" :loading="saving" :disabled="loading || deleting || !dirty">保存资料</el-button></div>
        </div>
      </form>
      <section class="profile-clear" aria-label="清空个人资料"><div><h2>清空个人资料</h2><p>清除昵称、头像和全部个人档案，保留账号与密码。</p></div><el-button type="danger" plain :loading="deleting" :disabled="busy || !hasSavedValues" @click="clearProfile">清空资料</el-button></section>
    </template>
  </PageShell>
</template>

<style scoped>
.profile-page { max-width: 1120px; }
.profile-state { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 16px; min-height: 220px; color: var(--text-muted); font-size: 14px; }
.profile-account { display: flex; align-items: center; gap: 16px; padding: 22px 0 28px; border-bottom: 1px solid var(--line); }
.account-summary { min-width: 0; flex: 1; }
.account-summary h2 { margin: 0 0 7px; overflow-wrap: anywhere; font-size: 18px; font-weight: 550; }
.account-summary p { margin: 0; overflow-wrap: anywhere; color: var(--text-muted); font-size: 12px; }
.account-role { flex-shrink: 0; padding: 5px 10px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); font-size: 12px; }
.profile-form fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.profile-section { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 36px; padding: 30px 0; border-bottom: 1px solid var(--line); }
.section-intro h2, .profile-clear h2 { margin: 0 0 9px; font-size: 14px; font-weight: 550; }
.section-intro p, .profile-clear p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.8; }
.profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 22px; align-items: start; }
.profile-field { min-width: 0; }
.profile-field label { display: block; margin-bottom: 9px; color: #4c586c; font-size: 13px; }
.profile-field input, .profile-field select { width: 100%; min-width: 0; height: 38px; padding: 0 11px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-size: 13px; }
.profile-field input::placeholder { color: #8a93a3; }
.profile-field input:hover, .profile-field select:hover { border-color: #b6c0d0; }
.profile-field [aria-invalid="true"] { border-color: var(--el-color-danger); }
.profile-field input:disabled, .profile-field select:disabled { background: var(--sidebar); color: var(--text-muted); }
.field-hint, .field-error { margin: 7px 0 0; font-size: 12px; line-height: 1.6; }
.field-hint, .profile-note { color: var(--text-muted); }
.field-error, .save-error { color: var(--el-color-danger); }
.profile-note, .save-error { margin: 18px 0; font-size: 12px; line-height: 1.8; }
.profile-save-bar { position: sticky; bottom: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; background: var(--surface); border-top: 1px solid var(--line); }
.profile-save-bar > span { color: var(--text-muted); font-size: 12px; }
.profile-save-bar > div { display: flex; gap: 10px; }
.profile-save-bar :deep(.el-button + .el-button) { margin-left: 0; }
.profile-clear { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--line); }
@media (max-width: 1050px) { .profile-section { grid-template-columns: 150px minmax(0, 1fr); gap: 24px; } }
@media (max-width: 900px) { .profile-section { grid-template-columns: minmax(0, 1fr); gap: 22px; } }
@media (max-width: 600px) { .profile-fields { grid-template-columns: minmax(0, 1fr); gap: 20px; }.profile-save-bar { align-items: stretch; flex-direction: column; gap: 12px; }.profile-save-bar > div { justify-content: flex-end; }.profile-clear { align-items: flex-start; flex-direction: column; gap: 16px; }.profile-account { gap: 12px; }.account-role { padding: 5px 7px; } }
</style>
