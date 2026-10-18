import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('renders common markdown and removes unsafe markup', () => {
    const html = renderMarkdown('# 标题\n\n| 出发 | 到达 |\n| --- | --- |\n| 上海 | 北京 |\n\n<script>alert(1)</script>[危险](javascript:alert(1))')
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<table>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('javascript:')
  })
})
