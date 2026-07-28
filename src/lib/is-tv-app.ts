const TV_SESSION_KEY = 'lanta-tv-mode'

declare global {
  interface Window {
    __LANTA_TV__?: boolean
    /** Offline leanback / Android TV remote mode (does not enable online tab picker). */
    __LANTA_REMOTE__?: boolean
    /** Session snapshot for the native TV shell to start playback without WebView click. */
    __lantaTvSession?: {
      slug: string
      userName: string
      userId: string
      videoFileNames: string[]
      videoTitles?: string[]
      videoSource?: 'drive' | 'hosted' | 'local'
    }
    /** Starts workout from the native TV Play button (hard navigation). */
    __lantaTvStartPlay?: () => string
    /** Playback helpers for the native TV control bar. */
    __lantaTvTogglePlay?: () => string
    __lantaTvNextVideo?: () => string
    __lantaTvPrevVideo?: () => string
    LantaTV?: {
      selectTab?: (slug: string) => void
      openTabPicker?: () => void
    }
  }
}

/**
 * Persists TV shell mode for the current browser tab / WebView session.
 */
export const markTvApp = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.__LANTA_TV__ = true
  try {
    sessionStorage.setItem(TV_SESSION_KEY, '1')
  } catch {
    // Private mode / storage blocked — in-memory flag still works.
  }
}

/**
 * Returns true when running inside the Lanta TV Android shell (or ?tv=1).
 */
export const isTvApp = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  if (window.__LANTA_TV__ === true) {
    return true
  }

  try {
    if (sessionStorage.getItem(TV_SESSION_KEY) === '1') {
      return true
    }
  } catch {
    // Ignore storage errors.
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get('tv') === '1') {
    markTvApp()
    return true
  }

  return false
}

/**
 * Returns true when D-pad / media-key playback controls should be active.
 * Covers the online TV shell and the offline Capacitor APK (Xiaomi / emulator / TV boxes).
 */
export const usesTvRemoteControls = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  if (isTvApp()) {
    return true
  }

  if (window.__LANTA_REMOTE__ === true) {
    return true
  }

  try {
    if (sessionStorage.getItem('lanta-remote-mode') === '1') {
      return true
    }
  } catch {
    // Ignore storage errors.
  }

  // Capacitor offline APK — always treat as remote-capable (TV box / emulator).
  try {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (capacitor?.isNativePlatform?.()) {
      return true
    }
  } catch {
    // Ignore.
  }

  const ua = navigator.userAgent
  return (
    /Android/i.test(ua)
    && (/TV/i.test(ua)
      || /Leanback/i.test(ua)
      || /AFT/i.test(ua)
      || /MIBOX/i.test(ua)
      || /MiBox/i.test(ua)
      || /BRAVIA/i.test(ua)
      || /Android TV/i.test(ua))
  )
}
