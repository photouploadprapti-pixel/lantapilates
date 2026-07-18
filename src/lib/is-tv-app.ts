const TV_SESSION_KEY = 'lanta-tv-mode'

declare global {
  interface Window {
    __LANTA_TV__?: boolean
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
