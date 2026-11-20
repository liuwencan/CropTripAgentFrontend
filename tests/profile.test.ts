import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import ProfileView from '@/views/ProfileView.vue'
import { profileApi } from '@/api/profileApi'
import { useAuthStore } from '@/store/auth'
import { clearToken, setToken } from '@/api/http'
import { ApiError } from '@/utils/errors'
import { validateProfile } from '@/utils/profile'
import type { ProfileOptions, UserProfile } from '@/types/profile'

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))

const options: ProfileOptions = {
  levels: [{ code: 'P6', label: '专业六级' }],
  genders: [{ code: 'M', label: '男' }, { code: 'F', label: '女' }],
  idTypes: [{ code: 0, label: '身份证' }, { code: 1, label: '护照' }],
  editableFields: ['nickName', 'avatar', 'baseCity', 'level', 'namePinyin', 'email', 'chineseName', 'idType', 'idNumber', 'phone', 'gender'],
}
const account = { id: 12, username: 'test-user', role: 'USER', nickName: '旧昵称', avatar: 'https://example.com/old.png' }
const existing: UserProfile = {
  account, profileExists: true,
  profile: { baseCity: '南京', level: 'P6', namePinyin: 'ZHANG SAN', email: 'old@example.com', chineseName: '张三', idType: 1, idNumber: 'AB1234567', phone: '+86 13800138000', gender: 'M' },
}
const empty: UserProfile = { account: { ...account, nickName: null, avatar: null }, profileExists: false, profile: null }
const stubs = {
  'el-button': { props: ['disabled', 'loading', 'nativeType'], template: '<button :type="nativeType || \'button\'" :disabled="disabled || loading"><slot /></button>' },
}
const wrappers: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(ProfileView, { global: { stubs } })
  wrappers.push(wrapper)
  return wrapper
}
function mockLoad(data: UserProfile = existing, definitions = options) {
  vi.spyOn(profileApi, 'options').mockResolvedValue(structuredClone(definitions))
  vi.spyOn(profileApi, 'get').mockResolvedValue(structuredClone(data))
}

beforeEach(() => { setActivePinia(createPinia()); useAuthStore().user = { ...account }; clearToken() })
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearToken()
  document.querySelectorAll('.el-message').forEach((node) => node.remove())
})

describe('personal profile page', () => {
  it.each(['objects', 'strings'] as const)('renders a new profile and saves identity fields with editableFields returned as %s', async (format) => {
    const identity = { chineseName: '李四', phone: '13900139000', idType: 0, idNumber: '11010119900101123X' }
    const definitions = {
      ...options,
      editableFields: format === 'objects' ? options.editableFields.map((code) => ({ code, label: code })) : options.editableFields,
    }
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const data = url.endsWith('/options') ? definitions : init.method === 'POST'
        ? { ...existing, profile: { ...existing.profile!, ...identity } } : empty
      return new Response(JSON.stringify({ success: true, data }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('.profile-section')).toHaveLength(3)
    expect(wrapper.findAll('.profile-field')).toHaveLength(11)
    expect(wrapper.text()).toContain('还没有个人档案')
    await wrapper.get('#profile-chineseName').setValue(identity.chineseName)
    await wrapper.get('#profile-phone').setValue(identity.phone)
    await wrapper.get('#profile-idType').setValue(identity.idType)
    await wrapper.get('#profile-idNumber').setValue(identity.idNumber)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const saveRequest = fetchMock.mock.calls.find(([, init]) => init.method === 'POST')!
    expect(saveRequest[0]).toBe('/user/profile')
    expect(JSON.parse(saveRequest[1].body)).toEqual(identity)
    expect(wrapper.text()).not.toContain('还没有个人档案')
    expect((wrapper.get('#profile-chineseName').element as HTMLInputElement).value).toBe(identity.chineseName)
    expect((wrapper.get('#profile-phone').element as HTMLInputElement).value).toBe(identity.phone)
    expect((wrapper.get('#profile-idNumber').element as HTMLInputElement).value).toBe(identity.idNumber)
  })

  it('loads server options and displays the saved real name, phone and document as editable fields', async () => {
    mockLoad()
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('#profile-level').text()).toContain('专业六级')
    expect(wrapper.get('label[for="profile-chineseName"]').text()).toBe('真实姓名')
    expect((wrapper.get('#profile-chineseName').element as HTMLInputElement).value).toBe('张三')
    expect(wrapper.get('#profile-phone').attributes('type')).toBe('tel')
    expect((wrapper.get('#profile-phone').element as HTMLInputElement).value).toBe('+86 13800138000')
    expect(wrapper.get('#profile-idNumber').attributes('type')).toBe('text')
    expect((wrapper.get('#profile-idNumber').element as HTMLInputElement).value).toBe('AB1234567')
    expect(wrapper.find('input[name="username"]').exists()).toBe(false)
  })

  it('lets a user fill and save their real name, phone and ID from an empty profile', async () => {
    mockLoad(empty)
    const identity = { chineseName: '李四', phone: '13900139000', idType: 0, idNumber: '11010119900101123X' }
    const create = vi.spyOn(profileApi, 'create').mockResolvedValue({ ...existing, profile: { ...existing.profile!, ...identity }, account: { ...empty.account, nickName: '新昵称' } })
    const update = vi.spyOn(profileApi, 'update')
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('还没有个人档案')
    await wrapper.get('#profile-nickName').setValue(' 新昵称 ')
    await wrapper.get('#profile-chineseName').setValue(identity.chineseName)
    await wrapper.get('#profile-phone').setValue(identity.phone)
    await wrapper.get('#profile-idType').setValue(identity.idType)
    await wrapper.get('#profile-idNumber').setValue(identity.idNumber)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledWith({ nickName: '新昵称', ...identity })
    expect(update).not.toHaveBeenCalled()
    expect(useAuthStore().user?.nickName).toBe('新昵称')
    expect((wrapper.get('#profile-chineseName').element as HTMLInputElement).value).toBe(identity.chineseName)
    expect((wrapper.get('#profile-phone').element as HTMLInputElement).value).toBe(identity.phone)
    expect((wrapper.get('#profile-idNumber').element as HTMLInputElement).value).toBe(identity.idNumber)
    expect(wrapper.text()).not.toContain('还没有个人档案')
  })

  it('updates only changed values, preserves numeric document code zero, and explicitly clears blanks', async () => {
    mockLoad()
    const update = vi.spyOn(profileApi, 'update').mockResolvedValue({ ...existing, profile: { ...existing.profile!, idType: 0, email: null } })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#profile-idType').setValue(0)
    await wrapper.get('#profile-email').setValue('   ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledWith({ idType: 0, clearFields: ['email'] })
  })

  it('uses editableFields to hide and omit fields the service does not allow editing', async () => {
    mockLoad(existing, { ...options, editableFields: ['nickName'] })
    const update = vi.spyOn(profileApi, 'update').mockResolvedValue(existing)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('#profile-level').exists()).toBe(false)
    await wrapper.get('#profile-nickName').setValue('新昵称')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledWith({ nickName: '新昵称' })
  })

  it('does not send empty saves and resets edits without a request', async () => {
    mockLoad()
    const update = vi.spyOn(profileApi, 'update')
    const wrapper = render()
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(update).not.toHaveBeenCalled()
    await wrapper.get('#profile-baseCity').setValue('上海')
    await wrapper.findAll('button').find((button) => button.text() === '放弃修改')!.trigger('click')
    expect((wrapper.get('#profile-baseCity').element as HTMLInputElement).value).toBe('南京')
    expect(update).not.toHaveBeenCalled()
  })

  it('shows field validation and preserves input after save errors', async () => {
    mockLoad()
    const update = vi.spyOn(profileApi, 'update').mockRejectedValue(new Error('服务暂时不可用'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#profile-email').setValue('invalid')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入有效的邮箱地址')
    expect(update).not.toHaveBeenCalled()
    await wrapper.get('#profile-email').setValue('new@example.com')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('服务暂时不可用')
    expect((wrapper.get('#profile-email').element as HTMLInputElement).value).toBe('new@example.com')
    expect(useAuthStore().user?.nickName).toBe('旧昵称')
  })

  it('explains concurrent profile changes without discarding the draft', async () => {
    mockLoad(empty)
    vi.spyOn(profileApi, 'create').mockRejectedValue(new ApiError({ message: 'conflict', status: 409, errorCode: 'PROFILE_ALREADY_EXISTS' }))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#profile-nickName').setValue('新昵称')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('请重新读取资料后编辑')
    expect((wrapper.get('#profile-nickName').element as HTMLInputElement).value).toBe('新昵称')
  })

  it('allows retrying a load failure', async () => {
    mockLoad()
    vi.mocked(profileApi.get).mockRejectedValueOnce(new Error('网络连接失败'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('网络连接失败')
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.findAll('button').find((button) => button.text() === '重新加载')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('#profile-nickName').exists()).toBe(true)
  })

  it('clears the profile only after confirmation and refreshes the account without removing it', async () => {
    mockLoad()
    const clear = vi.spyOn(profileApi, 'clear').mockResolvedValue(undefined)
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValue('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>)
    const wrapper = render()
    await flushPromises()
    const button = wrapper.findAll('button').find((item) => item.text() === '清空资料')!
    await button.trigger('click')
    await flushPromises()
    expect(clear).not.toHaveBeenCalled()
    vi.mocked(profileApi.get).mockResolvedValue(empty)
    await button.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(clear).toHaveBeenCalledOnce()
    expect(useAuthStore().user).toMatchObject({ id: 12, username: 'test-user', nickName: null, avatar: null })
    expect(wrapper.text()).toContain('还没有个人档案')
    await wrapper.get('#profile-email').setValue('new@example.com')
    const create = vi.spyOn(profileApi, 'create').mockResolvedValue(existing)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledWith({ email: 'new@example.com' })
  })
})

describe('profile contract', () => {
  it('uses the documented URLs, methods and authenticated header', async () => {
    setToken('profile-token')
    const fetchMock = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify({ success: true, data: url.endsWith('/options') ? options : existing })))
    vi.stubGlobal('fetch', fetchMock)
    await profileApi.get()
    await profileApi.options()
    await profileApi.create({ idType: 0 })
    await profileApi.update({ clearFields: ['avatar', 'phone'] })
    await profileApi.clear()
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method || 'GET'])).toEqual([
      ['/user/profile', 'GET'], ['/user/profile/options', 'GET'], ['/user/profile', 'POST'], ['/user/profile', 'PUT'], ['/user/profile', 'DELETE'],
    ])
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer profile-token')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ idType: 0 })
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ clearFields: ['avatar', 'phone'] })
  })

  it('accepts international phone and non-ID document formats, while rejecting unsupported values', () => {
    expect(validateProfile({ phone: '+1 (202) 555-0100', idNumber: 'AB-123456', idType: 0, namePinyin: 'zhang  san' }, options)).toEqual({})
    expect(validateProfile({ avatar: 'javascript:alert(1)', phone: 'abcdefg', level: 'P9', email: 'bad', namePinyin: '张三' }, options)).toMatchObject({
      avatar: expect.any(String), phone: expect.any(String), level: expect.any(String), email: expect.any(String), namePinyin: expect.any(String),
    })
  })
})
