import { requestData } from './http'
import type { PreferenceCategory, PreferenceValues, UserPreference } from '@/types/preference'

export const preferenceApi = {
  options() {
    return requestData<PreferenceCategory[]>('/preferences/options')
  },
  get() {
    return requestData<UserPreference>('/preferences')
  },
  save(preferences: PreferenceValues) {
    return requestData<UserPreference>('/preferences', { method: 'POST', body: JSON.stringify({ preferences }) })
  },
}
