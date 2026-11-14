export type PreferenceFieldType = 'single' | 'multi'

export interface PreferenceOption {
  key: string
  label: string
  type: PreferenceFieldType
  options: string[]
}

export interface PreferenceCategory {
  category: string
  label: string
  items: PreferenceOption[]
}

export type PreferenceValue = string | string[]
export type PreferenceValues = Record<string, PreferenceValue>

export interface UserPreference {
  userId?: string
  memorySummary?: string
  preferences?: PreferenceValues
}
