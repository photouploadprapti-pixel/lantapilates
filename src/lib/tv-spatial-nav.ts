/**
 * Collects visible, interactive elements that TV remotes should be able to focus.
 */
export const getTvFocusableElements = (): HTMLElement[] => {
  const nodes = document.querySelectorAll<HTMLElement>(
    [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','),
  )

  return Array.from(nodes).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') {
      return false
    }

    const style = window.getComputedStyle(element)
    if (
      style.display === 'none'
      || style.visibility === 'hidden'
      || style.pointerEvents === 'none'
      || Number(style.opacity) === 0
    ) {
      return false
    }

    const rect = element.getBoundingClientRect()
    return rect.width > 2 && rect.height > 2
  })
}

type NavDirection = 'up' | 'down' | 'left' | 'right'

/**
 * Finds the nearest focusable neighbor in a remote D-pad direction.
 *
 * @param current - Currently focused element
 * @param direction - Arrow key direction
 */
export const findTvFocusTarget = (
  current: HTMLElement,
  direction: NavDirection,
): HTMLElement | null => {
  const currentRect = current.getBoundingClientRect()
  const originX = currentRect.left + currentRect.width / 2
  const originY = currentRect.top + currentRect.height / 2

  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of getTvFocusableElements()) {
    if (candidate === current) {
      continue
    }

    const rect = candidate.getBoundingClientRect()
    const targetX = rect.left + rect.width / 2
    const targetY = rect.top + rect.height / 2
    const deltaX = targetX - originX
    const deltaY = targetY - originY

    const threshold = 12
    if (direction === 'down' && deltaY <= threshold) continue
    if (direction === 'up' && deltaY >= -threshold) continue
    if (direction === 'right' && deltaX <= threshold) continue
    if (direction === 'left' && deltaX >= -threshold) continue

    const primary = direction === 'up' || direction === 'down'
      ? Math.abs(deltaY)
      : Math.abs(deltaX)
    const secondary = direction === 'up' || direction === 'down'
      ? Math.abs(deltaX)
      : Math.abs(deltaY)

    // Reject candidates that are mostly off-axis from the pressed direction.
    if (secondary > primary * 3 && secondary > 160) {
      continue
    }

    const score = primary + secondary * 0.4
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

/**
 * Maps a keyboard event to a TV navigation direction when applicable.
 *
 * @param key - KeyboardEvent.key value
 */
export const getTvNavDirection = (key: string): NavDirection | null => {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      return null
  }
}
