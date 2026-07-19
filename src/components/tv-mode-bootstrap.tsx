'use client'

import { useEffect } from 'react'

import { useTvSpatialNav } from '@/hooks/use-tv-focus'
import { isTvApp, markTvApp } from '@/lib/is-tv-app'

/**
 * Activates TV shell styling and remote spatial navigation for the TV APK.
 */
export const TvModeBootstrap = () => {
  useTvSpatialNav()

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
