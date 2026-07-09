'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AdminLoginButton } from '@/components/admin-login-button'
import { LantaLogo } from '@/components/lanta-logo'
import { fetchTabletSession } from '@/lib/tablet-data'
import { getTabletPlayPath, saveTabletSession } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'
import type { TabletSlug } from '@/types/tablet'

type TabletWelcomeScreenProps = {
  slug: TabletSlug
}

/**
 * Tablet landing screen with assigned welcome message and play action.
 * @param slug - Tablet route slug (tab1–tab4)
 */
export const TabletWelcomeScreen = ({ slug }: TabletWelcomeScreenProps) => {
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [videoIds, setVideoIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      setIsLoading(true)
      setError(undefined)

      try {
        const session = await fetchTabletSession(slug)
        if (!active) {
          return
        }

        if (!session) {
          setError('No user assigned to this tablet yet. Ask your admin to assign one.')
          setUserName(null)
          setVideoIds([])
          setUserId(null)
          return
        }

        setUserName(session.userName)
        setVideoIds(session.videoIds)
        setUserId(session.userId)
      } catch (loadError) {
        if (!active) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Could not load tablet settings')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [slug])

  const handlePlay = () => {
    if (!userName || !userId) {
      return
    }

    if (videoIds.length === 0) {
      setError('No videos assigned yet. Ask your admin to add your playlist.')
      return
    }

    setIsStarting(true)
    saveTabletSession({
      slug,
      userName,
      userId,
      videoIds,
    })
    router.push(getTabletPlayPath(slug))
  }

  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col items-center justify-center bg-lanta-cream px-6',
        'pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]',
      )}
    >
      <AdminLoginButton onAuthenticated={() => router.push('/admin/')} />

      <div className="flex w-full max-w-md flex-col items-center">
        <LantaLogo size="lg" />

        <p className="mt-6 text-center text-base leading-relaxed text-lanta-charcoal/70">
          On-demand reformer Pilates — your way, every day.
        </p>

        {isLoading ? (
          <p className="mt-16 text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
        ) : userName ? (
          <h1 className="mt-16 text-center font-display text-5xl leading-tight text-lanta-charcoal sm:text-6xl">
            Welcome {userName}
          </h1>
        ) : null}

        {error ? (
          <p className="mt-10 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlay}
          disabled={isStarting || isLoading || !userName || videoIds.length === 0}
          className={cn(
            'mt-10 flex h-20 w-20 items-center justify-center rounded-full',
            'bg-lanta-taupe text-white shadow-md transition-transform',
            'hover:scale-105 hover:bg-lanta-taupe/90 active:scale-95',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
          )}
          aria-label="Play workout"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
