import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { appConfig } from '@/config'
import { preferenceApi } from '@/api/preferenceApi'
import PreferenceView from '@/views/PreferenceView.vue'

const options = [
  { category: 'flight', label: '机票偏好', items: [
    { key: 'flight_cabin', label: '舱位偏好', type: 'single', options: ['经济舱', '公务舱'] },
    { key: 'flight_airline', label: '偏好航司', type: 'multi', options: ['国航(CA)', '东航(MU)', '无偏好'] },
  ] },
]
const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
const flush = async () => { for (let index = 0; index < 6; index += 1) await new Promise((resolve) => setTimeout(resolve, 0)) }
const stubs = {
  'el-button': { template: '<button type="button"><slot /></button>' },
  'el-card': { template: '<section><slot name="header" /><slot /></section>' },
  'el-icon': { template: '<i><slot /></i>' },
}

afterEach(() => { vi.restoreAllMocks(); appConfig.enableMock = false })

describe('preference settings', () => {
  it('reads options and current memory, then saves the selected values', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(options))
      .mockResolvedValueOnce(json({ userId: '1', memorySummary: '用户偏好经济舱', preferences: { flight_cabin: '经济舱' } }))
      .mockResolvedValueOnce(json({ userId: '1', memorySummary: '已保存', preferences: { flight_cabin: '公务舱', flight_airline: ['国航(CA)'] } }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PreferenceView, { global: { stubs } })
    await flush()
    expect(wrapper.text()).toContain('机票偏好')
    expect(wrapper.get('.option-tag[aria-pressed="true"]').text()).toBe('经济舱')

    await wrapper.findAll('.option-tag').find((tag) => tag.text() === '公务舱')!.trigger('click')
    await wrapper.findAll('.option-tag').find((tag) => tag.text() === '国航(CA)')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '保存偏好')!.trigger('click')
    await flush()

    const [url, init] = fetchMock.mock.calls[2]
    expect(String(url)).toContain('/preferences')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ preferences: { flight_airline: ['国航(CA)'], flight_cabin: '公务舱' } })
  })

  it('keeps single selection toggleable and clears a field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(options)).mockResolvedValueOnce(json({ memorySummary: '', preferences: {} })))
    const wrapper = mount(PreferenceView, { global: { stubs } })
    await flush()
    const cabin = () => wrapper.findAll('.option-tag').find((tag) => tag.text() === '公务舱')!
    await cabin().trigger('click')
    expect(cabin().attributes('aria-pressed')).toBe('true')
    await cabin().trigger('click')
    expect(cabin().attributes('aria-pressed')).toBe('false')
    await cabin().trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === '清除')!.trigger('click')
    expect(cabin().attributes('aria-pressed')).toBe('false')
  })

  it('shows a recoverable error when the preference endpoints fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('服务不可用')))
    const wrapper = mount(PreferenceView, { global: { stubs } })
    await flush()
    expect(wrapper.text()).toContain('偏好设置')
    expect(wrapper.text()).toContain('服务不可用')
    expect(wrapper.text()).toContain('重新加载')
  })

  it('posts the documented payload shape', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({ userId: '1', preferences: {} }))
    vi.stubGlobal('fetch', fetchMock)
    await preferenceApi.save({ flight_cabin: '经济舱', flight_airline: ['国航(CA)'] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/preferences')
    expect(JSON.parse(init.body)).toEqual({ preferences: { flight_cabin: '经济舱', flight_airline: ['国航(CA)'] } })
    await preferenceApi.options()
    expect(String(fetchMock.mock.calls[1][0])).toContain('/preferences/options')
  })
})
