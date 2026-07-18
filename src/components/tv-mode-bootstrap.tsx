'use client'

import { useEffect } from 'react'

import { isTvApp, markTvApp } from '@/lib/is-tv-app'

/**
 * Activates TV shell styling and focus behavior when launched from the TV APK.
 */
export const TvModeBootstrap = () => {
  useEffect(() => {
    if (!isTvApp()) {
      return
    }

    markTvApp()
    document.documentElement.dataset.tvApp = 'true'
    document.documentElement.classList.add('tv-app')

    return () => {
      delete document.documentElement.dataset.tvApp
      document.documentElement.classList.remove('tv-app')
    }
  }, [])

  return null
}
