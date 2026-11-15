import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { appConfig } from '@/config'
import { traceApi } from '@/api/traceApi'
import TraceManagementView from '@/views/admin/TraceManagementView.vue'

const span = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  traceId: 'trace-2026-001',
  spanId: 'span-agent',
  parentSpanId: null,
  sessionId: 81,
  userId: 206,
  agentId: 'agent-travel',
  agentName: '差旅规划 Agent',
  spanType: 'AGENT',
  operationName: '差旅规划',
  status: 'FAILED',
  startTime: '2026-11-15T10:00:00+08:00',
  endTime: '2026-11-15T10:00:02.400+08:00',
  durationMs: 2400,
  ...overrides,
})

const page = (data: unknown[]) => ({ success: true, data, pageNo: 1, pageSize: 12, totalCount: data.length, totalPage: 1 })
const stubs = {
  'el-input': { template: '<input />' },
  'el-select': { template: '<select><slot /></select>' },
  'el-option': { template: '<option><slot /></option>' },
  'el-button': { template: '<button><slot /></button>' },
  'el-pagination': { template: '<div />' },
  'el-icon': { template: '<span><slot /></span>' },
}

afterEach(() => { vi.restoreAllMocks(); appConfig.enableMock = true })

describe('trace API', () => {
  it('uses the backend GET routes and omits empty query values', async () => {
    appConfig.enableMock = false
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page([])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { traceId: 'trace/1', totalDurationMs: 2500, totalInputTokens: 12, totalOutputTokens: 8, spans: [] } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await traceApi.query({ pageNo: 1, pageSize: 12, traceId: '', sessionId: '', status: 'FAILED', startFrom: '2026-11-15T10:00' })
    const detail = await traceApi.detail('trace/1')

    expect(fetchMock.mock.calls[0][0]).toContain('/business/agent-traces?')
    expect(fetchMock.mock.calls[0][0]).toContain('pageNo=1')
    expect(fetchMock.mock.calls[0][0]).toContain('status=FAILED')
    expect(fetchMock.mock.calls[0][0]).toContain('startFrom=2026-11-15T10%3A00')
    expect(fetchMock.mock.calls[0][0]).not.toContain('traceId=')
    expect(fetchMock.mock.calls[1][0]).toContain('/business/agent-traces/trace/trace%2F1')
    expect(detail).toMatchObject({ totalDurationMs: 2500, totalInputTokens: 12, totalOutputTokens: 8, spans: [] })
  })
})

describe('trace management view', () => {
  it('groups spans by trace and shows timeline details and failed tool context', async () => {
    appConfig.enableMock = false
    const agent = span({ agentName: 'MasterAgent', operationName: 'MasterAgent' })
    const model = span({ id: 2, spanId: 'span-model', parentSpanId: 'span-agent', spanType: 'MODEL', operationName: 'gpt-travel', modelName: 'gpt-travel', status: 'SUCCESS', iteration: 1, inputTokens: 156, outputTokens: 68, outputMessage: [{ role: 'assistant', content: '候选酒店已整理完成' }] })
    const tool = span({ id: 3, spanId: 'span-tool', parentSpanId: 'span-model', spanType: 'TOOL', operationName: '查询酒店', toolName: 'hotel_search', toolCallId: 'call-77', status: 'FAILED', errorSummary: '酒店服务响应超时', toolResult: { code: 'UPSTREAM_TIMEOUT' }, attributes: { retryable: true } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page([agent, model, tool])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { traceId: agent.traceId, totalDurationMs: 3100, totalInputTokens: 156, totalOutputTokens: 68, spans: [agent, model, tool] } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(TraceManagementView, { global: { stubs } })
    await flushPromises()
    await wrapper.findAll('.span-item').at(2)?.trigger('click')

    expect(wrapper.text()).toContain('智能体调用链路')
    expect(wrapper.find('.trace-dashboard').exists()).toBe(true)
    expect(wrapper.find('.success-gauge').text()).toBe('0%')
    expect(wrapper.find('.failure-metric strong').text()).toBe('1')
    expect(wrapper.text()).toContain('请求链路')
    expect(wrapper.text()).toContain('3 spans')
    expect(wrapper.text()).toContain('查询酒店')
    expect(wrapper.text()).toContain('酒店服务响应超时')
    expect(wrapper.text()).toContain('输入 / 输出 Token')
    expect(wrapper.text()).toContain('总输入 Token')
    expect(wrapper.text()).toContain('总输出 Token')
    expect(wrapper.find('.detail-facts').text()).toContain('156')
    expect(wrapper.find('.detail-facts').text()).toContain('68')
    expect(wrapper.find('.detail-facts').text()).toContain('3.10 s')
    const agentTimelineText = wrapper.findAll('.span-item')[0].text()
    expect(agentTimelineText.match(/MasterAgent/g)).toHaveLength(1)
    const modelTimelineText = wrapper.findAll('.span-item')[1].text()
    expect(modelTimelineText.match(/gpt-travel/g)).toHaveLength(1)
    expect(modelTimelineText).toContain('第 1 轮')

    await wrapper.findAll('.span-item').at(1)?.trigger('click')
    expect(wrapper.text()).toContain('输出消息')
    expect(wrapper.text()).toContain('候选酒店已整理完成')
  })
})
