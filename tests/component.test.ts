import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageComposer from '@/components/MessageComposer.vue'
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
})
