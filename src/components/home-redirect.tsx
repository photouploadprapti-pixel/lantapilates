'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client redirect from the site root to the first tablet route.
 */
export const HomeRedirect = () => {
  const router = useRouter()

  useEffect(() => {
    router.replace('/tab1/')
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
      <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
    </div>
  )
}
