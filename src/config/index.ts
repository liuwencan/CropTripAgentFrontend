export interface AppConfig {
  apiBaseUrl: string
  streamBaseUrl: string
  appTitle: string
  enableMock: boolean
  features: Record<string, boolean>
}

const booleanValue = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

const cleanBaseUrl = (value: unknown, fallback: string) => {
  const candidate = typeof value === 'string' ? value.trim() : fallback
  if (!candidate) return ''
  if (candidate.startsWith('/')) return candidate.replace(/\/$/, '')
  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol')
    return candidate.replace(/\/$/, '')
  } catch {
    throw new Error(`配置的后端地址无效：${candidate}`)
  }
}

export function loadConfig(): AppConfig {
  const runtime = window.__APP_CONFIG__ ?? {}
  const env = import.meta.env
  const apiBaseUrl = cleanBaseUrl(runtime.apiBaseUrl ?? env.VITE_API_BASE_URL ?? '', '')
  const streamBaseUrl = cleanBaseUrl(runtime.streamBaseUrl ?? env.VITE_STREAM_BASE_URL ?? apiBaseUrl, apiBaseUrl)
  const features = { admin: true, travelWorkflow: true, ...(runtime.features ?? {}) }
  document.title = String(runtime.appTitle ?? env.VITE_APP_TITLE ?? '企业差旅助手')
  return {
    apiBaseUrl,
    streamBaseUrl,
    appTitle: document.title,
    enableMock: booleanValue(runtime.enableMock ?? env.VITE_ENABLE_MOCK, false),
    features,
  }
}

export const appConfig = loadConfig()
