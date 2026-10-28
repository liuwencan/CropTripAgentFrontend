import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageComposer from '@/components/MessageComposer.vue'
import AskUserPrompt from '@/components/AskUserPrompt.vue'
import TravelWorkflowBlock from '@/components/TravelWorkflowBlock.vue'

describe('shared interaction components', () => {
  it('emits a message on Enter and can stop generation', async () => {
    const wrapper = mount(MessageComposer, { props: { sending: false }, global: { stubs: { 'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown="$attrs.onKeydown" />' }, 'el-button': { template: '<button @click="$attrs.onClick"><slot /></button>' } } } })
    await wrapper.find('textarea').setValue('查询差旅政策')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['查询差旅政策'])
    await wrapper.setProps({ sending: true })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
  })
  it('renders policy and confirmation blocks', () => {
    const wrapper = mount(TravelWorkflowBlock, { global: { stubs: { 'el-icon': true, 'el-tag': true, 'el-button': true } }, props: { block: { workflowId: 'w1', status: 'success', policy: { id: 'p1', title: '住宿标准', compliant: true, explanation: '符合标准', status: 'success' }, action: { id: 'a1', workflowId: 'w1', title: '确认预订', summary: '预订上海到北京', status: 'pending' } } } })
    expect(wrapper.text()).toContain('住宿标准')
    expect(wrapper.text()).toContain('确认预订')
  })
  it('keeps the draft when Enter confirms Chinese input or generation is active', async () => {
    const wrapper = mount(MessageComposer, { props: { sending: false }, global: { stubs: { 'el-button': { template: '<button><slot /></button>' } } } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('北京出差')
    await textarea.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(textarea.element.value).toBe('北京出差')
    await wrapper.setProps({ sending: true })
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(textarea.element.value).toBe('北京出差')
    await wrapper.setProps({ sending: false })
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['北京出差'])
  })
  it('renders selectable clarification options and emits a readable answer', async () => {
    const wrapper = mount(AskUserPrompt, { props: { prompt: { question: '选择出发城市', ui_type: 'select', options: ['北京', '上海'] } }, global: { stubs: { 'el-icon': true } } })
    await wrapper.get('input[value="上海"]').setValue(true)
    await wrapper.get('button.ask-submit').trigger('click')
    expect(wrapper.emitted('submit')?.[0]).toEqual(['上海', '上海'])
    await wrapper.setProps({ submitted: true })
    expect(wrapper.text()).toContain('已提交')
  })
  it('renders and submits a required multi-field clarification form', async () => {
    const wrapper = mount(AskUserPrompt, { props: { prompt: {
      question: '请问您想查询哪个城市的天气？',
      ui_type: 'form',
      fields: [
        { name: 'city', label: '查询城市', placeholder: '请输入城市名称，如：北京、上海', required: true, type: 'text' },
        { name: 'date', label: '查询日期', placeholder: '选择要查询的日期', type: 'date' },
        { name: 'purpose', label: '查询目的', options: ['出差行程规划', '返程安排', '日常了解', '其他'], type: 'select' },
      ],
    } }, global: { stubs: { 'el-icon': true } } })
    expect(wrapper.findAll('.ask-field')).toHaveLength(3)
    expect(wrapper.get('input[aria-label="查询城市"]').attributes('required')).toBeDefined()
    await wrapper.get('button.ask-submit').trigger('click')
    expect(wrapper.text()).toContain('请填写查询城市')
    await wrapper.get('input[aria-label="查询城市"]').setValue('上海')
    await wrapper.get('input[aria-label="查询日期"]').setValue('2026-10-28')
    await wrapper.get('select[aria-label="查询目的"]').setValue('出差行程规划')
    await wrapper.get('button.ask-submit').trigger('click')
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { city: '上海', date: '2026-10-28', purpose: '出差行程规划' },
      '查询城市：上海；查询日期：2026-10-28；查询目的：出差行程规划',
    ])
  })
})
