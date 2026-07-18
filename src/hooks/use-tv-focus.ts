'use client'

import { useEffect, useRef } from 'react'

import { isTvApp } from '@/lib/is-tv-app'

/**
 * Auto-focuses the first TV-focusable control so remotes can navigate without a cursor.
 *
 * @param enabled - When false, skips focusing (e.g. while loading)
 */
export const useTvAutoFocus = (enabled = true): void => {
  const didFocus = useRef(false)

  useEffect(() => {
    if (!enabled || !isTvApp() || didFocus.current) {
      return
    }

    const focusTarget = () => {
      const preferred = document.querySelector<HTMLElement>('[data-tv-autofocus]')
      const fallback = document.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      )
      const target = preferred ?? fallback
      if (!target) {
        return false
      }

      target.focus()
      didFocus.current = true
      return true
    }

    if (focusTarget()) {
      return
    }

    const timer = window.setTimeout(() => {
      focusTarget()
    }, 120)

    return () => window.clearTimeout(timer)
  }, [enabled])
}
