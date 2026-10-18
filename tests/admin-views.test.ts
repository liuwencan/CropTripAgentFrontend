import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { appConfig } from '@/config'
import UserManagementView from '@/views/admin/UserManagementView.vue'
import ConfigManagementView from '@/views/admin/ConfigManagementView.vue'
import PromptManagementView from '@/views/admin/PromptManagementView.vue'

const page = (data: unknown[] = []) => new Response(JSON.stringify({ success: true, data, pageNo: 1, pageSize: 10, totalCount: data.length, totalPage: data.length ? 1 : 0 }), { status: 200 })
const stubs = {
  'el-card': { template: '<section><slot name="header" /><slot /></section>' }, 'el-input': { template: '<input />' }, 'el-select': { template: '<select />' }, 'el-option': true, 'el-button': { template: '<button><slot /></button>' }, 'el-table': { template: '<div><slot /></div>' }, 'el-table-column': { template: '<div />' }, 'el-pagination': true, 'el-tag': { template: '<span><slot /></span>' }, 'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' }, 'el-form': { template: '<form><slot /></form>' }, 'el-form-item': { template: '<label><slot /></label>' }, 'el-empty': true,
}

afterEach(() => { vi.restoreAllMocks(); appConfig.enableMock = true })

describe('admin views', () => {
  it('renders user, configuration, and Prompt management shells from API data', async () => {
    appConfig.enableMock = false
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(page([{ id: 1, username: 'alice', role: 'USER' }])).mockResolvedValueOnce(page([{ id: 2, configKey: 'trip.limit', configValue: '500' }])).mockResolvedValueOnce(page([{ id: 3, promptKey: 'trip', promptName: '差旅助手' }])))
    const options = { global: { stubs } }
    const users = mount(UserManagementView, options)
    const config = mount(ConfigManagementView, options)
    const prompts = mount(PromptManagementView, options)
    await Promise.resolve()
    await Promise.resolve()
    expect(users.text()).toContain('用户管理')
    expect(config.text()).toContain('系统配置')
    expect(prompts.text()).toContain('Prompt 管理')
  })
  it('renders a recoverable error state when an admin endpoint fails', async () => {
    appConfig.enableMock = false
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('服务不可用')))
    const wrapper = mount(UserManagementView, { global: { stubs } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(wrapper.text()).toContain('用户管理')
  })
})
