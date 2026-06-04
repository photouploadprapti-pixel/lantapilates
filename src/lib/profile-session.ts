import type { UserProfile } from '@/types/profile'

const STORAGE_KEY = 'lanta-pilates-profile'

/**
 * Persists profile for the current browser tab session only.
 * @param profile - Validated user profile
 */
export const saveProfileSession = (profile: UserProfile): void => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

/**
 * Reads profile from the current tab session, if present.
 */
export const loadProfileSession = (): UserProfile | null => {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isUserProfile(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Clears stored profile (e.g. when restarting onboarding).
 */
export const clearProfileSession = (): void => {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

const isUserProfile = (value: unknown): value is UserProfile => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.fullName === 'string'
    && typeof record.age === 'number'
    && typeof record.heightCm === 'number'
    && typeof record.weightKg === 'number'
  )
}
