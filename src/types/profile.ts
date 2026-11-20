import type { User } from './auth'

export interface ProfileValues {
  nickName: string | null
  avatar: string | null
  baseCity: string | null
  level: string | null
  namePinyin: string | null
  email: string | null
  chineseName: string | null
  idType: number | null
  idNumber: string | null
  phone: string | null
  gender: string | null
}

export type ProfileField = keyof ProfileValues
export type ProfileDraft = { [K in ProfileField]: NonNullable<ProfileValues[K]> | '' }
export type ProfilePayload = Partial<ProfileValues> & { clearFields?: ProfileField[] }

export interface UserProfile {
  account: User
  profileExists: boolean
  profile: Omit<ProfileValues, 'nickName' | 'avatar'> | null
}

export interface ProfileOption<T extends string | number> { code: T; label: string }
export interface ProfileOptions {
  levels: ProfileOption<string>[]
  genders: ProfileOption<string>[]
  idTypes: ProfileOption<number>[]
  editableFields: ProfileField[]
}

export type ProfileOptionsResponse = Omit<ProfileOptions, 'editableFields'> & {
  editableFields: (ProfileOption<ProfileField> | ProfileField)[]
}
