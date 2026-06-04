'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { loadBodyAreasSession } from '@/lib/body-areas-session'
import { clearAllAppSession } from '@/lib/app-session'
import { loadProfileSession } from '@/lib/profile-session'
import type { BodyAreasSelection } from '@/types/body-area'
import { BODY_AREAS } from '@/types/body-area'

const labelFor = (id: string): string =>
  BODY_AREAS.find((area) => area.id === id)?.label ?? id

/**
 * Placeholder for the third screen; requires profile and body area selections.
 */
export const NextStepPlaceholderScreen = () => {
  const router = useRouter()
  const [bodyAreas, setBodyAreas] = useState<BodyAreasSelection | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!loadProfileSession()) {
      router.replace('/')
      return
    }
    const stored = loadBodyAreasSession()
    if (!stored || (stored.need.length === 0 && stored.avoid.length === 0)) {
      router.replace('/session')
      return
    }
    setBodyAreas(stored)
    setIsReady(true)
  }, [router])

  const handleRestart = () => {
    clearAllAppSession()
    router.replace('/')
  }

  if (!isReady || !bodyAreas) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <AppShell
      title="Next Step"
      subtitle="Screen three is ready for your instructions. Your selections are saved for this session."
    >
      <div className="space-y-6 rounded-sm border border-lanta-sand bg-white/80 p-6">
        <div>
          <p className="text-sm tracking-wide text-emerald-700 uppercase">Body areas need</p>
          <p className="mt-2 text-lg">
            {bodyAreas.need.length > 0
              ? bodyAreas.need.map(labelFor).join(', ')
              : 'None selected'}
          </p>
        </div>
        <div>
          <p className="text-sm tracking-wide text-red-700 uppercase">Body areas avoid</p>
          <p className="mt-2 text-lg">
            {bodyAreas.avoid.length > 0
              ? bodyAreas.avoid.map(labelFor).join(', ')
              : 'None selected'}
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-sm leading-relaxed text-lanta-charcoal/60">
        Describe what this screen should do and we will replace this placeholder.
      </p>

      <div className="mt-8">
        <Button type="button" variant="secondary" onClick={handleRestart}>
          Start over
        </Button>
      </div>
    </AppShell>
  )
}
