/// <reference types="vite/client" />

interface Window {
  __APP_CONFIG__?: Partial<{
    apiBaseUrl: string
    streamBaseUrl: string
    appTitle: string
    enableMock: boolean
    features: Record<string, boolean>
  }>
}
