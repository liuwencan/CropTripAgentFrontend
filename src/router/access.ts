import type { RouteLocationNormalized } from 'vue-router'

export function canEnterRoute(to: Pick<RouteLocationNormalized, 'meta'>, authenticated: boolean, admin: boolean, adminEnabled = true) {
  if (to.meta.guest && authenticated) return { name: 'workspace' }
  if (!to.meta.guest && !authenticated) return { name: 'login', query: { redirect: (to as RouteLocationNormalized).fullPath } }
  if (to.meta.admin && (!admin || !adminEnabled)) return { name: 'workspace', query: { denied: '1' } }
  return undefined
}
