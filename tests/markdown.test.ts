import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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

    expect(wrapper.find('.x-md-renderer').exists()).toBe(true)
    await wrapper.setProps({ source: '## 完整内容' })
    expect(wrapper.find('h2').text()).toBe('完整内容')
  })

  it('preserves all digits in long table values while streamed content updates', async () => {
    const completeMarkdown = [
      '已查询到差旅申请单，共 2 条：',
      '',
      '| # | 申请单号 | 出差事由 | 出发地 | 目的地 | 状态 |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 1 | 7ceb96ffedacad018c | 项目评审 | 杭州 | 广州 | 已审批 |',
      '| 2 | 0adbbf911fed4b9a11acffa | 参加会议 | 深圳 | 上海 | 已取消 |',
    ].join('\n')
    const wrapper = mount(MarkdownContent, { props: { source: '', isStreaming: true } })
    expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).props('enableAnimate')).toBe(true)

    for (let offset = 0; offset < completeMarkdown.length; offset += 24) {
      await wrapper.setProps({ source: completeMarkdown.slice(0, offset + 24) })
    }
    await wrapper.setProps({ isStreaming: false })
    expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).props('enableAnimate')).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual([
      '1', '7ceb96ffedacad018c', '项目评审', '杭州', '广州', '已审批',
      '2', '0adbbf911fed4b9a11acffa', '参加会议', '深圳', '上海', '已取消',
    ])
  })
})
