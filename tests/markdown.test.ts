import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRender from 'markstream-vue'
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
    expect(unsafe.find('a').exists()).toBe(false)
  })

  it('updates rendered markdown as streamed content changes', async () => {
    const wrapper = mount(MarkdownContent, { props: { source: '部分内容' } })

    expect(wrapper.findComponent(MarkdownRender).exists()).toBe(true)
    await wrapper.setProps({ source: '## 完整内容' })
    expect(wrapper.find('h2').text()).toBe('完整内容')
  })

  it('normalizes compact list markers without changing code blocks or dividers', () => {
    const wrapper = mount(MarkdownContent, {
      props: {
        source: [
          '温馨提示：',
          '',
          '-已通过（1条）：单号 A',
          '-待审批（3条）：单号 B、C、D',
          '',
          '1.第一步',
          '2.第二步',
          '',
          '---',
          '',
          '```md',
          '-代码中的文本',
          '1.代码中的编号',
          '```',
        ].join('\n'),
      },
    })

    expect(wrapper.findAll('ul li').map((item) => item.text())).toEqual(['已通过（1条）：单号 A', '待审批（3条）：单号 B、C、D'])
    expect(wrapper.findAll('ol li').map((item) => item.text())).toEqual(['第一步', '第二步'])
    expect(wrapper.find('hr').exists()).toBe(true)
    expect(wrapper.find('pre code').text()).toContain('-代码中的文本')
    expect(wrapper.find('pre code').text()).toContain('1.代码中的编号')
  })

  it('renders a table when streamed markdown completes its syntax', async () => {
    const completeMarkdown = [
      '已查询到差旅申请单，共 2 条：',
      '',
      '| # | 申请单号 | 出差事由 | 出发地 | 目的地 | 状态 |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 1 | 7ceb96ffedacad018c | 项目评审 | 杭州 | 广州 | 已审批 |',
      '| 2 | 0adbbf911fed4b9a11acffa | 参加会议 | 深圳 | 上海 | 已取消 |',
    ].join('\n')
    const wrapper = mount(MarkdownContent, { props: { source: '', isStreaming: true } })
    const renderer = wrapper.findComponent(MarkdownRender)

    expect(renderer.props('typewriter')).toBe(true)

    for (let offset = 0; offset < completeMarkdown.length; offset += 24) {
      await wrapper.setProps({ source: completeMarkdown.slice(0, offset + 24) })
      await new Promise((resolve) => setTimeout(resolve, 12))
    }
    const rendererId = renderer.vm.$.uid
    await wrapper.setProps({ isStreaming: false })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const settledRenderer = wrapper.findComponent(MarkdownRender)

    expect(settledRenderer.vm.$.uid).toBe(rendererId)
    expect(settledRenderer.props('final')).toBe(true)
    expect(settledRenderer.props('typewriter')).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual([
      '1', '7ceb96ffedacad018c', '项目评审', '杭州', '广州', '已审批',
      '2', '0adbbf911fed4b9a11acffa', '参加会议', '深圳', '上海', '已取消',
    ])
  })
})
