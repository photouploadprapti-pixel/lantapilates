'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LantaLogo } from '@/components/lanta-logo'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { isTvApp, markTvApp } from '@/lib/is-tv-app'
import { getTabletPath } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'
import { TABLET_SLUGS, type TabletSlug } from '@/types/tablet'

const TAB_LABELS: Record<TabletSlug, string> = {
  tab1: 'Tablet 1',
  tab2: 'Tablet 2',
  tab3: 'Tablet 3',
  tab4: 'Tablet 4',
}

/**
 * TV-only startup screen: pick which tablet (tab1–tab4) to open.
 */
export const TvTabPickerScreen = () => {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useTvAutoFocus(ready)

  useEffect(() => {
    markTvApp()
    setReady(true)
  }, [])

  const handleSelect = (slug: TabletSlug) => {
    markTvApp()
    try {
      sessionStorage.setItem('lanta-tv-selected-tab', slug)
    } catch {
      // Ignore storage errors.
    }

    if (typeof window !== 'undefined' && window.LantaTV?.selectTab) {
      window.LantaTV.selectTab(slug)
      return
    }

    router.replace(`${getTabletPath(slug)}`)
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center bg-lanta-cream',
        'tv-safe-screen px-[6vw] py-[5vh]',
      )}
    >
      <LantaLogo size="md" />
      <h1 className="font-display mt-6 text-center text-4xl font-light tracking-[0.08em] text-lanta-charcoal uppercase md:text-5xl">
        Choose tablet
      </h1>
      <p className="mt-3 max-w-xl text-center text-base text-lanta-charcoal/70">
        Select a tablet with the remote, then press OK.
      </p>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
        {TABLET_SLUGS.map((slug, index) => (
          <button
            key={slug}
            type="button"
            data-tv-autofocus={index === 0 ? 'true' : undefined}
            onClick={() => handleSelect(slug)}
            className={cn(
              'flex min-h-[7.5rem] flex-col items-center justify-center rounded-sm',
              'border-2 border-lanta-sand bg-white px-4 py-6 text-center',
              'transition-colors hover:border-lanta-taupe hover:bg-lanta-sand/40',
              'focus-visible:outline-none',
            )}
          >
            <span className="font-display text-3xl text-lanta-taupe">{index + 1}</span>
            <span className="mt-2 text-sm font-medium tracking-[0.14em] text-lanta-charcoal uppercase">
              {TAB_LABELS[slug]}
            </span>
          </button>
        ))}
      </div>

      {!isTvApp() ? (
        <p className="mt-8 text-center text-xs text-lanta-charcoal/45">
          Tip: open with <code className="px-1">?tv=1</code> for TV focus styling.
        </p>
      ) : null}
    </div>
  )
}
