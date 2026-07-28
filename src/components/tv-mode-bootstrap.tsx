'use client'

import { useEffect } from 'react'

import { useTvSpatialNav } from '@/hooks/use-tv-focus'
import { isTvApp, markTvApp, usesTvRemoteControls } from '@/lib/is-tv-app'

/**
 * Activates TV / remote styling and D-pad spatial navigation.
 * Online TV shell uses markTvApp; offline APK uses __LANTA_REMOTE__ only.
 */
export const TvModeBootstrap = () => {
  useTvSpatialNav()

  useEffect(() => {
    if (isTvApp()) {
      markTvApp()
      document.documentElement.dataset.tvApp = 'true'
      document.documentElement.classList.add('tv-app')
    }

    if (usesTvRemoteControls()) {
      document.documentElement.dataset.lantaRemote = 'true'
    }

    return () => {
      delete document.documentElement.dataset.tvApp
      delete document.documentElement.dataset.lantaRemote
      document.documentElement.classList.remove('tv-app')
    }
  }, [])

  return null
}
