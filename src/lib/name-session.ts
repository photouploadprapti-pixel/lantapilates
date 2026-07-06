const STORAGE_KEY = 'lanta-pilates-display-name'

/**
 * Persists the user's display name for the current browser tab session.
 * @param fullName - Trimmed full name from the welcome screen
 */
export const saveNameSession = (fullName: string): void => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, fullName)
}

/**
 * Reads the display name from the current tab session, if present.
 */
export const loadNameSession = (): string | null => {
  if (typeof window === 'undefined') return null
  const name = sessionStorage.getItem(STORAGE_KEY)?.trim()
  return name && name.length > 0 ? name : null
}

/**
 * Clears the stored display name (e.g. when restarting the app).
 */
export const clearNameSession = (): void => {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}
