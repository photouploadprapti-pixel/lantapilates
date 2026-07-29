'use client'

import { useEffect, useRef } from 'react'

import { usesTvRemoteControls } from '@/lib/is-tv-app'
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
    if (!enabled || didFocus.current) {
      return
    }

    // Offline Capacitor + online TV both need autofocus; don't wait only on remote flag
    // (flag may be injected slightly after first paint).
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
    }, 200)

    const retry = window.setTimeout(() => {
      if (!didFocus.current) {
        focusTarget()
      }
    }, 800)

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(retry)
    }
  }, [enabled])
}

/**
 * Enables D-pad spatial navigation between focusable controls on Android TV WebViews.
 * Fixes remotes getting stuck when built-in browser spatial nav cannot jump large gaps.
 */
export const useTvSpatialNav = (): void => {
  useEffect(() => {
    if (!usesTvRemoteControls()) {
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

      const active = document.activeElement
      const inTextField =
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement

      // Keep Left/Right for caret movement inside text fields; Up/Down leave the field.
      if (inTextField && (direction === 'left' || direction === 'right')) {
        return
      }

      const focusables = getTvFocusableElements()
      const current =
        active instanceof HTMLElement && focusables.includes(active)
          ? active
          : focusables[0]

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
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
