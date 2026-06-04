'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app-shell'
import { BodyAreaChip } from '@/components/body-area-chip'
import { BodyAreasSection } from '@/components/body-areas-section'
import { Button } from '@/components/ui/button'
import {
  EMPTY_SELECTION,
  loadBodyAreasSession,
  saveBodyAreasSession,
} from '@/lib/body-areas-session'
import { loadProfileSession } from '@/lib/profile-session'
import { cn } from '@/lib/utils'
import { BODY_AREAS, type BodyAreaId, type BodyAreasSelection } from '@/types/body-area'

/**
 * Second screen: assign body areas to need (green) or avoid (red), mutually exclusive.
 */
export const BodyAreasScreen = () => {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [selection, setSelection] = useState<BodyAreasSelection>(EMPTY_SELECTION)

  useEffect(() => {
    if (!loadProfileSession()) {
      router.replace('/')
      return
    }
    const stored = loadBodyAreasSession()
    if (stored) setSelection(stored)
    setIsReady(true)
  }, [router])

  const needSet = useMemo(() => new Set(selection.need), [selection.need])
  const avoidSet = useMemo(() => new Set(selection.avoid), [selection.avoid])

  const hasSelection = selection.need.length > 0 || selection.avoid.length > 0

  const toggleNeed = useCallback((id: BodyAreaId) => {
    setSelection((prev) => {
      if (prev.need.includes(id)) {
        return {
          need: prev.need.filter((area) => area !== id),
          avoid: prev.avoid,
        }
      }
      return {
        need: [...prev.need, id],
        avoid: prev.avoid.filter((area) => area !== id),
      }
    })
  }, [])

  const toggleAvoid = useCallback((id: BodyAreaId) => {
    setSelection((prev) => {
      if (prev.avoid.includes(id)) {
        return {
          need: prev.need,
          avoid: prev.avoid.filter((area) => area !== id),
        }
      }
      return {
        need: prev.need.filter((area) => area !== id),
        avoid: [...prev.avoid, id],
      }
    })
  }, [])

  const handleContinue = () => {
    saveBodyAreasSession(selection)
    router.push('/next')
  }

  if (!isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <AppShell
      title="Focus Areas"
      subtitle="Tap areas you want to work on or avoid. Each area can only appear in one list."
      mainClassName="max-w-2xl"
    >
      <div className="space-y-10">
        <BodyAreasSection
          title="Body Areas Need"
          hint="Tap to highlight in green. Removes the area from Avoid."
          accentClass="text-emerald-700"
        >
          {BODY_AREAS.filter((area) => !avoidSet.has(area.id)).map((area) => (
            <BodyAreaChip
              key={`need-${area.id}`}
              areaId={area.id}
              label={area.label}
              variant={needSet.has(area.id) ? 'need' : 'neutral'}
              onPress={() => toggleNeed(area.id)}
            />
          ))}
        </BodyAreasSection>

        <BodyAreasSection
          title="Body Areas Avoid"
          hint="Tap to highlight in red. Removes the area from Need."
          accentClass="text-red-700"
        >
          {BODY_AREAS.filter((area) => !needSet.has(area.id)).map((area) => (
            <BodyAreaChip
              key={`avoid-${area.id}`}
              areaId={area.id}
              label={area.label}
              variant={avoidSet.has(area.id) ? 'avoid' : 'neutral'}
              onPress={() => toggleAvoid(area.id)}
            />
          ))}
        </BodyAreasSection>

        <div
          className={cn(
            'pt-2 transition-all duration-300',
            hasSelection
              ? 'opacity-100 translate-y-0'
              : 'pointer-events-none opacity-0 translate-y-2',
          )}
        >
          <Button type="button" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
