'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { OfflineWelcomeScreen } from '@/components/offline-welcome-screen'
import { isNativeApp } from '@/lib/is-native-app'
import { isTvApp } from '@/lib/is-tv-app'

/**
 * Routes TV / web to the online tablet flow; Capacitor tablet shells to offline welcome.
 */
export const HomeRedirect = () => {
  const router = useRouter()
  const [mode, setMode] = useState<'loading' | 'native' | 'web'>('loading')

  useEffect(() => {
    // Lanta TV APK opens the tablet picker first (not a hardcoded tab1).
    if (isTvApp()) {
      setMode('web')
      router.replace('/tv/')
      return
    }

    if (isNativeApp()) {
      setMode('native')
      return
    }

    setMode('web')
    router.replace('/tab1/')
  }, [router])

  if (mode === 'native') {
    return <OfflineWelcomeScreen />
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
      <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
    </div>
  )
}
