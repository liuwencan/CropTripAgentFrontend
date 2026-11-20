import type { ProfileDraft, ProfileField, ProfileOptions, ProfilePayload, UserProfile } from '@/types/profile'

export interface ProfileFieldDefinition {
  key: ProfileField
  label: string
  maxLength?: number
  placeholder?: string
  options?: 'levels' | 'genders' | 'idTypes'
  hint?: string
}

export const profileSections: { title: string; description: string; fields: ProfileFieldDefinition[] }[] = [
  { title: '账号展示', description: '设置在工作空间中展示的昵称和头像。', fields: [
    { key: 'nickName', label: '昵称', maxLength: 20, placeholder: '你的昵称' },
    { key: 'avatar', label: '头像地址', maxLength: 255, placeholder: 'https://example.com/avatar.png', hint: '填写可访问的 HTTP 或 HTTPS 图片地址。' },
  ] },
  { title: '个人信息', description: '填写真实姓名、联系方式和证件信息，便于出行预订与身份核对。', fields: [
    { key: 'chineseName', label: '真实姓名', maxLength: 64, placeholder: '请输入与证件一致的真实姓名' },
    { key: 'gender', label: '性别', options: 'genders' },
    { key: 'phone', label: '手机号', maxLength: 32, placeholder: '请输入手机号，支持国际区号' },
    { key: 'email', label: '邮箱', maxLength: 128, placeholder: 'name@example.com' },
    { key: 'idType', label: '证件类型', options: 'idTypes' },
    { key: 'idNumber', label: '证件号码', maxLength: 64, placeholder: '请输入身份证号或其他证件号码', hint: '使用身份证时填写身份证号；其他证件填写对应号码。' },
  ] },
  { title: '差旅信息', description: '补充常驻城市、职级和姓名拼音，便于安排差旅。', fields: [
    { key: 'baseCity', label: '常驻城市', maxLength: 128, placeholder: '例如 南京' },
    { key: 'level', label: '职级', options: 'levels' },
    { key: 'namePinyin', label: '姓名拼音', maxLength: 128, placeholder: '例如 ZHANG SAN', hint: '姓与名之间用空格分隔。' },
  ] },
]

export function profileDraft(data?: UserProfile): ProfileDraft {
  return Object.fromEntries(profileSections.flatMap((section) => section.fields.map(({ key }) => [
    key, (key === 'nickName' || key === 'avatar' ? data?.account[key] : data?.profile?.[key]) ?? '',
  ]))) as ProfileDraft
}

function normalized(value: string | number | null | undefined) {
  return typeof value === 'string' ? value.trim() : value ?? ''
}

export function profilePatch(draft: ProfileDraft, saved: ProfileDraft, editable: ProfileField[]): ProfilePayload {
  const values: Record<string, string | number | ProfileField[]> = {}
  const clearFields: ProfileField[] = []
  for (const { key } of profileSections.flatMap((section) => section.fields)) {
    if (!editable.includes(key)) continue
    const next = normalized(draft[key]); const previous = normalized(saved[key])
    if (next === previous) continue
    if (next === '') clearFields.push(key)
    else values[key] = next
  }
  if (clearFields.length) values.clearFields = clearFields
  return values as ProfilePayload
}

export function validateProfile(payload: ProfilePayload, options: ProfileOptions): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {}
  for (const field of profileSections.flatMap((section) => section.fields)) {
    const value = payload[field.key]
    if (value == null) continue
    if (field.maxLength && String(value).length > field.maxLength) errors[field.key] = `${field.label}最多 ${field.maxLength} 个字符`
    if (field.options && !options[field.options].some((option) => option.code === value)) errors[field.key] = `请选择有效的${field.label}`
  }
  if (payload.avatar) {
    try {
      if (!['http:', 'https:'].includes(new URL(payload.avatar).protocol)) throw new Error()
    } catch { errors.avatar = '请输入有效的 HTTP 或 HTTPS 图片地址' }
  }
  if (payload.namePinyin && !/^[a-z]+(?: +[a-z]+)+$/i.test(payload.namePinyin)) errors.namePinyin = '请使用字母填写姓与名，并用空格分隔'
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.email = '请输入有效的邮箱地址'
  if (payload.phone && !/^(?=.{7,32}$)(?=.*\d)[\d+ ()-]+$/.test(payload.phone)) errors.phone = '请输入 7–32 位电话号码，可包含数字、+、空格、括号和连字符'
  return errors
}
