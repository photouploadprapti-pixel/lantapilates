/**
 * Offline Android app settings stored in localStorage.
 * Name + ordered playlist + optional display titles for local playback.
 */

const SETTINGS_KEY = 'lanta-offline-app-settings'

export type OfflineAppSettings = {
  userName: string
  /** Playlist order (file names). */
  selectedFileNames: string[]
  /** Optional display titles keyed by file name. */
  videoTitles: Record<string, string>
  updatedAt: string
}

const DEFAULT_SETTINGS: OfflineAppSettings = {
  userName: '',
  selectedFileNames: [],
  videoTitles: {},
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
    const videoTitles: Record<string, string> = {}
    if (parsed.videoTitles && typeof parsed.videoTitles === 'object') {
      Object.entries(parsed.videoTitles).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          videoTitles[key] = value.trim()
        }
      })
    }

    return {
      userName: typeof parsed.userName === 'string' ? parsed.userName : '',
      selectedFileNames: Array.isArray(parsed.selectedFileNames)
        ? parsed.selectedFileNames.filter((name): name is string => typeof name === 'string')
        : [],
      videoTitles,
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
  const current = loadOfflineAppSettings()
  const next: OfflineAppSettings = {
    ...current,
    ...settings,
    videoTitles: settings.videoTitles
      ? { ...settings.videoTitles }
      : current.videoTitles,
    updatedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}
