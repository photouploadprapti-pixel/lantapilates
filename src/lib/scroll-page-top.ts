/**
 * Resets window/document scroll so welcome screens show the logo at the top.
 * Safe to call repeatedly after layout changes (e.g. exiting TV playback).
 */
export const scrollPageToTop = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  const reset = () => {
    try {
      window.scrollTo(0, 0)
    } catch {
      // Ignore.
    }

    try {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    } catch {
      // Ignore.
    }

    const root = document.getElementById('__next')
    if (root) {
      root.scrollTop = 0
    }
  }

  reset()
  requestAnimationFrame(reset)
  window.setTimeout(reset, 50)
  window.setTimeout(reset, 250)
}
