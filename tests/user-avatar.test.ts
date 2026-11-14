import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationMessage from '@/components/ConversationMessage.vue'
import UserAvatar from '@/components/UserAvatar.vue'

describe('user profile avatars', () => {
  it('renders the signed-in user avatar beside their conversation message', () => {
    const user = {
      id: 1212,
      username: 'test123',
      nickName: '途灵328668',
      avatar: 'https://example.com/avatar.png',
      role: 'USER',
    }

    const wrapper = mount(ConversationMessage, {
      props: { message: { id: 1, conversationId: 2, role: 'user', content: '查询差旅政策' }, user },
      global: { stubs: { 'el-icon': true, 'el-button': true } },
    })

    expect(wrapper.get('.message-user-avatar').attributes('aria-label')).toBe('途灵328668的头像')
    expect(wrapper.get('.message-user-avatar img').attributes('src')).toBe('https://example.com/avatar.png')
  })

  it('uses the first nickname character when the avatar is missing or fails to load', async () => {
    const wrapper = mount(UserAvatar, { props: { src: 'https://example.com/broken.png', name: '途灵328668' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toBe('途')
    expect(wrapper.attributes('aria-label')).toBe('途灵328668的头像')
  })
})
