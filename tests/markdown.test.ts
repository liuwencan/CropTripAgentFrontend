import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { MarkdownRenderer } from 'x-markdown-vue'
import MarkdownContent from '@/components/MarkdownContent.vue'

describe('MarkdownContent', () => {
  it('renders common markdown and sanitizes unsafe markup and URLs', () => {
    const wrapper = mount(MarkdownContent, {
      props: { source: '# 标题\n\n| 出发 | 到达 |\n| --- | --- |\n| 上海 | 北京 |\n\n[安全](https://example.com)' },
    })

    expect(wrapper.find('h1').text()).toBe('标题')
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('a').attributes('href')).toBe('https://example.com')
    const unsafe = mount(MarkdownContent, { props: { source: '<script>alert(1)</script>[危险](javascript:alert(1))' } })
    expect(unsafe.find('script').exists()).toBe(false)
    expect(unsafe.html()).not.toContain('javascript:')
  })

  it('updates rendered markdown as streamed content changes', async () => {
    const wrapper = mount(MarkdownContent, { props: { source: '部分内容' } })

    expect(wrapper.find('.markdown-body.x-md-renderer').exists()).toBe(true)
    await wrapper.setProps({ source: '## 完整内容' })
    expect(wrapper.find('h2').text()).toBe('完整内容')
  })

  it('rebuilds a table when streamed markdown completes its table syntax', async () => {
    const wrapper = mount(MarkdownContent, { props: { source: '| From | To |\n| --- |', isStreaming: true } })

    await wrapper.setProps({ source: '| From | To |\n| --- | --- |\n| Shanghai | Beijing |' })
    const streamingRenderer = wrapper.findComponent(MarkdownRenderer).vm.$.uid
    await wrapper.setProps({ isStreaming: false })

    expect(wrapper.findComponent(MarkdownRenderer).vm.$.uid).not.toBe(streamingRenderer)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual(['Shanghai', 'Beijing'])
  })
})
