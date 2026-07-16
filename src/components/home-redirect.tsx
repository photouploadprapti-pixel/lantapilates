'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { OfflineWelcomeScreen } from '@/components/offline-welcome-screen'
import { isNativeApp } from '@/lib/is-native-app'

/**
 * Routes native Android shells to the offline welcome flow; web to tablet tab1.
 */
export const HomeRedirect = () => {
  const router = useRouter()
  const [mode, setMode] = useState<'loading' | 'native' | 'web'>('loading')

  useEffect(() => {
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
