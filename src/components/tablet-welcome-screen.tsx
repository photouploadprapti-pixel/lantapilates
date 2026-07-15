'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AdminLoginButton } from '@/components/admin-login-button'
import { LantaLogo } from '@/components/lanta-logo'
import { VideoFolderSetupScreen } from '@/components/video-folder-setup-screen'
import { Button } from '@/components/ui/button'
import { useLocalVideos } from '@/hooks/use-local-videos'
import {
  loadOfflineTabletSession,
  saveOfflineTabletSession,
} from '@/lib/offline-tablet-session'
import { fetchTabletSession } from '@/lib/tablet-data'
import { getTabletPlayPath, saveTabletSession } from '@/lib/tablet-session'
import { findMatchingVideoName } from '@/lib/video-name-match'
import { cn } from '@/lib/utils'
import type { TabletSlug } from '@/types/tablet'

type TabletWelcomeScreenProps = {
  slug: TabletSlug
}

/**
 * Tablet landing screen with assigned welcome message, folder setup, and play action.
 * @param slug - Tablet route slug (tab1–tab4)
 */
export const TabletWelcomeScreen = ({ slug }: TabletWelcomeScreenProps) => {
  const router = useRouter()
  const {
    isReady,
    hasFolder,
    folderName,
    files,
    isLoading: isFolderLoading,
    changeFolder,
  } = useLocalVideos()
  const [userName, setUserName] = useState<string | null>(null)
  const [videoFileNames, setVideoFileNames] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [folderSetupDone, setFolderSetupDone] = useState(false)

  const handleFolderComplete = useCallback(() => {
    setFolderSetupDone(true)
  }, [])

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
          const cached = loadOfflineTabletSession(slug)
          if (cached) {
            setIsOffline(true)
            setUserName(cached.userName)
            setVideoFileNames(cached.videoFileNames)
            setUserId(cached.userId)
            return
          }

          setError('No user assigned to this tablet yet. Ask your admin to assign one.')
          setUserName(null)
          setVideoFileNames([])
          setUserId(null)
          return
        }

        setIsOffline(false)
        setUserName(session.userName)
        setVideoFileNames(session.videoFileNames)
        setUserId(session.userId)
        saveOfflineTabletSession({
          slug: session.slug,
          userName: session.userName,
          userId: session.userId,
          videoFileNames: session.videoFileNames,
          cachedAt: new Date().toISOString(),
        })
      } catch (loadError) {
        if (!active) {
          return
        }

        const cached = loadOfflineTabletSession(slug)
        if (cached) {
          setIsOffline(true)
          setUserName(cached.userName)
          setVideoFileNames(cached.videoFileNames)
          setUserId(cached.userId)
          setError(undefined)
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

  const matchedCount = videoFileNames.filter((assigned) =>
    findMatchingVideoName(
      assigned,
      files.map((file) => file.name),
    ),
  ).length

  const handlePlay = () => {
    if (!userName || !userId) {
      return
    }

    if (videoFileNames.length === 0) {
      setError('No videos assigned yet. Ask your admin to assign videos from the library.')
      return
    }

    if (!hasFolder || files.length === 0) {
      setError('Select your video folder first so assigned videos can play offline.')
      setFolderSetupDone(false)
      return
    }

    if (matchedCount === 0) {
      setError(
        'None of your assigned videos were found in the selected folder. Check that file names match.',
      )
      return
    }

    setIsStarting(true)
    saveTabletSession({
      slug,
      userName,
      userId,
      videoFileNames,
    })
    router.push(getTabletPlayPath(slug))
  }

  if (isReady && (!hasFolder || files.length === 0) && !folderSetupDone) {
    return <VideoFolderSetupScreen onComplete={handleFolderComplete} />
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

        {isLoading || isFolderLoading ? (
          <p className="mt-16 text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
        ) : userName ? (
          <h1 className="mt-16 text-center font-display text-5xl leading-tight text-lanta-charcoal sm:text-6xl">
            Welcome {userName}
          </h1>
        ) : null}

        {folderName ? (
          <p className="mt-4 text-center text-sm text-lanta-charcoal/60">
            Video folder: <span className="font-medium text-lanta-charcoal">{folderName}</span>
            {videoFileNames.length > 0 ? (
              <>
                {' · '}
                {matchedCount}/{videoFileNames.length} ready
              </>
            ) : null}
          </p>
        ) : null}

        {isOffline ? (
          <p className="mt-3 text-center text-xs tracking-wide text-lanta-charcoal/50 uppercase">
            Offline mode — using cached assignments
          </p>
        ) : null}

        {error ? (
          <p className="mt-10 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlay}
          disabled={
            isStarting ||
            isLoading ||
            isFolderLoading ||
            !userName ||
            videoFileNames.length === 0 ||
            matchedCount === 0
          }
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

        <Button
          type="button"
          variant="ghost"
          className="mt-6 w-auto text-sm text-lanta-charcoal/70"
          onClick={() => void changeFolder()}
        >
          Change video folder
        </Button>
      </div>
    </div>
  )
}
