import { reactive } from 'vue'

const STORAGE_KEY = 'corp_trip_request_routing'

export interface RequestRoutingState {
  enabled: boolean
  addresses: string[]
}

export interface ParsedAddresses {
  addresses: string[]
  invalid: string[]
}

function normalizeAddress(value: string): string | undefined {
  const candidate = value.trim().replace(/[;,]+$/, '')
  if (!candidate) return undefined
  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined
    return candidate.replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

function readState(): RequestRoutingState {
  if (typeof localStorage === 'undefined') return { enabled: false, addresses: [] }
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as Partial<RequestRoutingState>
    const addresses = Array.isArray(value.addresses)
      ? value.addresses.map((address) => normalizeAddress(String(address))).filter((address): address is string => Boolean(address))
      : []
    return {
      enabled: value.enabled === true && addresses.length > 0,
      addresses,
    }
  } catch {
    return { enabled: false, addresses: [] }
  }
}

export const requestRouting = reactive<RequestRoutingState>(readState())
let nextAddressIndex = 0

function persist() {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: requestRouting.enabled, addresses: requestRouting.addresses }))
}

export function parseAddresses(input: string): ParsedAddresses {
  const addresses: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const token of input.split(/[\s,;]+/)) {
    if (!token.trim()) continue
    const normalized = normalizeAddress(token)
    if (!normalized) {
      invalid.push(token)
      continue
    }
    if (!seen.has(normalized)) {
      seen.add(normalized)
      addresses.push(normalized)
    }
  }
  return { addresses, invalid }
}

export function setRequestRouting(next: Partial<RequestRoutingState>) {
  if (next.addresses) requestRouting.addresses = [...next.addresses]
  if (typeof next.enabled === 'boolean') requestRouting.enabled = next.enabled
  if (requestRouting.addresses.length === 0) requestRouting.enabled = false
  nextAddressIndex = 0
  persist()
}

/** Pick one configured machine for the next request. */
export function getRequestBase(fallback = ''): string {
  if (!requestRouting.enabled || requestRouting.addresses.length === 0) return fallback
  const address = requestRouting.addresses[nextAddressIndex % requestRouting.addresses.length]
  nextAddressIndex = (nextAddressIndex + 1) % requestRouting.addresses.length
  return address
}

export function resetRequestRouting() {
  requestRouting.enabled = false
  requestRouting.addresses = []
  nextAddressIndex = 0
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
}
