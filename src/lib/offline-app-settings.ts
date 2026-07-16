/**
 * Offline Android app settings stored in localStorage.
 * Name + selected video file names for local playlist playback.
 */

const SETTINGS_KEY = 'lanta-offline-app-settings'

export type OfflineAppSettings = {
  userName: string
  selectedFileNames: string[]
  updatedAt: string
}

const DEFAULT_SETTINGS: OfflineAppSettings = {
  userName: '',
  selectedFileNames: [],
  updatedAt: new Date(0).toISOString(),
}

/**
 * Loads offline app settings from local storage.
 */
export const loadOfflineAppSettings = (): OfflineAppSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    return DEFAULT_SETTINGS
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OfflineAppSettings>
    return {
      userName: typeof parsed.userName === 'string' ? parsed.userName : '',
      selectedFileNames: Array.isArray(parsed.selectedFileNames)
        ? parsed.selectedFileNames.filter((name): name is string => typeof name === 'string')
        : [],
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Persists offline app settings.
 *
 * @param settings - Partial settings to merge and save
 */
export const saveOfflineAppSettings = (
  settings: Partial<OfflineAppSettings>,
): OfflineAppSettings => {
  const next: OfflineAppSettings = {
    ...loadOfflineAppSettings(),
    ...settings,
    updatedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}
