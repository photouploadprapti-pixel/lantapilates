'use client'

import { useEffect, useRef } from 'react'

import { isTvApp } from '@/lib/is-tv-app'
import {
  findTvFocusTarget,
  getTvFocusableElements,
  getTvNavDirection,
} from '@/lib/tv-spatial-nav'

/**
 * Auto-focuses the preferred TV control so remotes start on a useful action.
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
      const focusables = getTvFocusableElements()
      const target = preferred ?? focusables[0]
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
    }, 160)

    return () => window.clearTimeout(timer)
  }, [enabled])
}

/**
 * Enables D-pad spatial navigation between focusable controls on Android TV WebViews.
 * Fixes remotes getting stuck when built-in browser spatial nav cannot jump large gaps.
 */
export const useTvSpatialNav = (): void => {
  useEffect(() => {
    if (!isTvApp()) {
      return
    }

    /**
     * Moves focus with arrow keys when the remote presses D-pad directions.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = getTvNavDirection(event.key)
      if (!direction) {
        return
      }

      // Let text fields keep native caret movement.
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement
      ) {
        return
      }

      const current =
        active instanceof HTMLElement && getTvFocusableElements().includes(active)
          ? active
          : getTvFocusableElements()[0]

      if (!current) {
        return
      }

      const next = findTvFocusTarget(current, direction)
      if (!next) {
        // Keep focus on a valid control even if no neighbor exists.
        if (active !== current) {
          event.preventDefault()
          current.focus()
        }
        return
      }

      event.preventDefault()
      event.stopPropagation()
      next.focus()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
