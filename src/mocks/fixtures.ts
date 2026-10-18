import type { Conversation, StreamEvent } from '@/types/conversation'
import type { LoginData } from '@/types/auth'

export const mockUser: LoginData = {
  tokenName: 'token',
  tokenValue: 'mock-demo-token',
  expiresIn: 86400,
  user: { id: 1, username: 'demo.admin', role: 'ADMIN', mustChangePassword: false },
}

export const mockConversation: Conversation = { id: 1, title: '我的差旅规划', status: 'ACTIVE', messageCount: 2 }

export function mockStream(question: string): StreamEvent[] {
  const chunks = [`我来帮你规划“${question}”。`, '\n\n### 差旅建议\n', '- 先确认出发城市和日期\n', '- 再根据企业差标筛选交通与酒店\n\n', '请补充出发地、目的地和出行日期。']
  return [
    ...chunks.map((content, sequence) => ({ version: 1 as const, type: 'message.delta' as const, sequence, payload: { content } })),
    { version: 1, type: 'workflow.update', sequence: chunks.length, payload: { workflowId: 'demo-trip', status: 'success', policy: { id: 'policy-1', title: '交通差旅标准', compliant: true, explanation: '当前示例行程符合企业标准', status: 'success' } } },
    { version: 1, type: 'message.done', sequence: chunks.length + 1 },
    { version: 1, type: 'done', sequence: chunks.length + 2 },
  ]
}
