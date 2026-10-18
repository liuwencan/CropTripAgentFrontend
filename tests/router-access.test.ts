import { describe, expect, it } from 'vitest'
import { canEnterRoute } from '@/router/access'

const route = (meta: Record<string, unknown>, fullPath = '/admin/users') => ({ meta, fullPath }) as any

describe('route access', () => {
  it('protects private and admin routes', () => {
    expect(canEnterRoute(route({}), false, false)).toMatchObject({ name: 'login' })
    expect(canEnterRoute(route({ admin: true }), true, false)).toMatchObject({ name: 'workspace' })
    expect(canEnterRoute(route({ admin: true }), true, true)).toBeUndefined()
  })
})
