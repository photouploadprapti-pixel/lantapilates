'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AdminLoginButton } from '@/components/admin-login-button'
import { LantaLogo } from '@/components/lanta-logo'
import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { getHostedVideoUrl } from '@/lib/hosted-videos'
import { preloadHostedPlaylist } from '@/lib/hosted-video-preload'
import { isTvApp } from '@/lib/is-tv-app'
import { titleFromFileName } from '@/lib/local-video-catalog'
import {
  loadOfflineTabletSession,
  saveOfflineTabletSession,
} from '@/lib/offline-tablet-session'
import { fetchTabletSession } from '@/lib/tablet-data'
import { getTabletPlayPath, saveTabletSession } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'
import type { TabletSlug } from '@/types/tablet'

type TabletWelcomeScreenProps = {
  slug: TabletSlug
}

/**
 * Online tablet landing: assigned user + hosted playlist play action.
 * On TV, the first videos warm in the background so Play starts instantly.
 *
 * @param slug - Tablet route slug (tab1–tab4)
 */
export const TabletWelcomeScreen = ({ slug }: TabletWelcomeScreenProps) => {
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [videoFileNames, setVideoFileNames] = useState<string[]>([])
  const [videoTitles, setVideoTitles] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [showTvPlayer, setShowTvPlayer] = useState(false)

  const canPlay = Boolean(userName && userId && videoFileNames.length > 0 && !isLoading && !isStarting)
  useTvAutoFocus(!isLoading && canPlay && !showTvPlayer)

  const playlist = useMemo((): LocalPlaylistVideo[] => {
    return videoFileNames.map((fileName, index) => {
      const rawTitle = videoTitles[index] ?? fileName
      const safeName = /\.(mp4|m4v|webm|mov|ts|mts|m2ts)$/i.test(fileName)
        ? fileName
        : `${fileName}.mp4`

      return {
        id: fileName,
        title: titleFromFileName(rawTitle),
        src: getHostedVideoUrl(safeName),
        fileName: safeName,
      }
    })
  }, [videoFileNames, videoTitles])

  useEffect(() => {
    setTvMode(isTvApp())
  }, [])

  // Warm first clips as soon as the tab session is known (before Play).
  useEffect(() => {
    if (!tvMode || playlist.length === 0) {
      return
    }

    preloadHostedPlaylist(
      playlist.map((video) => video.src),
      Math.min(3, playlist.length),
    )
  }, [tvMode, playlist])

  /**
   * Starts inline TV playback using the already-warmed player (no full page reload).
   */
  const startInlineTvPlayback = (): string => {
    if (!userName || !userId) {
      return 'no-user'
    }
    if (videoFileNames.length === 0) {
      return 'no-videos'
    }

    saveTabletSession({
      slug,
      userName,
      userId,
      videoFileNames,
      videoTitles,
      videoSource: 'hosted',
    })

    setIsStarting(false)
    setShowTvPlayer(true)
    document.body.classList.add('tv-playback')

    try {
      window.history.replaceState(null, '', `/${slug}/play/?tv=1`)
    } catch {
      // History API may be restricted; native bar still updates via bridge.
    }

    try {
      window.LantaTV?.showPlayControls?.()
    } catch {
      // Bridge optional outside the Android shell.
    }

    return 'inline'
  }

  /**
   * Hides inline TV playback and restores the welcome URL/controls.
   */
  const exitInlineTvPlayback = (): string => {
    const element = document.querySelector('video')
    if (element instanceof HTMLVideoElement) {
      try {
        element.pause()
      } catch {
        // Ignore.
      }
    }

    setShowTvPlayer(false)
    setIsStarting(false)
    document.body.classList.remove('tv-playback')

    try {
      window.history.replaceState(null, '', `/${slug}/?tv=1`)
    } catch {
      // Ignore.
    }

    try {
      window.LantaTV?.showWelcomeControls?.()
    } catch {
      // Ignore.
    }

    return 'ok'
  }

  // Expose session + start/exit API for the native TV shell.
  useEffect(() => {
    if (!tvMode) {
      return
    }

    window.__lantaTvSession =
      userName && userId && videoFileNames.length > 0
        ? {
            slug,
            userName,
            userId,
            videoFileNames,
            videoTitles,
            videoSource: 'hosted',
          }
        : undefined

    window.__lantaTvStartPlay = () => startInlineTvPlayback()
    window.__lantaTvExitPlay = () => exitInlineTvPlayback()

    return () => {
      delete window.__lantaTvSession
      delete window.__lantaTvStartPlay
      delete window.__lantaTvExitPlay
    }
  }, [tvMode, slug, userName, userId, videoFileNames, videoTitles])

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
            setVideoTitles(cached.videoFileNames)
            setUserId(cached.userId)
            return
          }

          setError('No user assigned to this tablet yet. Ask your admin to assign one.')
          setUserName(null)
          setVideoFileNames([])
          setVideoTitles([])
          setUserId(null)
          return
        }

        setIsOffline(false)
        setUserName(session.userName)
        setVideoFileNames(session.videoFileNames)
        setVideoTitles(session.videoTitles ?? session.videoFileNames)
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
          setVideoTitles(cached.videoFileNames)
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

  const handlePlay = () => {
    if (!userName || !userId) {
      return
    }

    if (videoFileNames.length === 0) {
      setError('No videos assigned yet. Ask your admin to assign videos.')
      return
    }

    if (tvMode || isTvApp()) {
      startInlineTvPlayback()
      return
    }

    setIsStarting(true)
    saveTabletSession({
      slug,
      userName,
      userId,
      videoFileNames,
      videoTitles,
      videoSource: 'hosted',
    })
    router.push(getTabletPlayPath(slug))
  }

  /**
   * Returns to the TV tablet picker (native bridge or /tv route).
   */
  const handleChangeTablet = () => {
    if (typeof window !== 'undefined' && window.LantaTV?.openTabPicker) {
      window.LantaTV.openTabPicker()
      return
    }

    router.replace('/tv/')
  }

  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col items-center justify-center bg-lanta-cream',
        tvMode
          ? 'tv-safe-screen'
          : cn(
            'px-6',
            'pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]',
          ),
        showTvPlayer ? 'overflow-hidden bg-black' : null,
      )}
    >
      {tvMode && playlist.length > 0 ? (
        <div
          className={cn(
            showTvPlayer
              ? 'fixed inset-0 z-50 bg-black'
              : 'pointer-events-none fixed top-0 left-0 z-0 h-px w-px overflow-hidden opacity-0',
          )}
          aria-hidden={!showTvPlayer}
        >
          <NativePlaylistPlayer
            videos={playlist}
            className="h-full w-full"
            hideChrome
            autoPlay={showTvPlayer}
            onBack={() => {
              exitInlineTvPlayback()
            }}
          />
        </div>
      ) : null}

      {!tvMode ? (
        <AdminLoginButton onAuthenticated={() => router.push('/admin/')} />
      ) : null}

      <div
        className={cn(
          'flex w-full flex-col items-center',
          tvMode ? 'max-w-2xl' : 'max-w-md',
          showTvPlayer ? 'hidden' : null,
        )}
      >
        <LantaLogo size={tvMode ? 'md' : 'lg'} />

        <p
          className={cn(
            'text-center leading-relaxed text-lanta-charcoal/70',
            tvMode ? 'mt-3 text-sm' : 'mt-6 text-base',
          )}
        >
          On-demand reformer Pilates — your way, every day.
        </p>

        {isLoading ? (
          <p
            className={cn(
              'text-sm tracking-wide text-lanta-charcoal/60 uppercase',
              tvMode ? 'mt-8' : 'mt-16',
            )}
          >
            Loading…
          </p>
        ) : userName ? (
          <h1
            className={cn(
              'text-center font-display leading-tight text-lanta-charcoal',
              tvMode ? 'mt-8 text-4xl sm:text-5xl' : 'mt-16 text-5xl sm:text-6xl',
            )}
          >
            Welcome {userName}
          </h1>
        ) : null}

        {videoFileNames.length > 0 ? (
          <p className={cn('text-center text-sm text-lanta-charcoal/60', tvMode ? 'mt-2' : 'mt-4')}>
            {videoFileNames.length} video{videoFileNames.length === 1 ? '' : 's'} assigned
            {tvMode ? ' · preparing playback…' : ''}
          </p>
        ) : null}

        {isOffline ? (
          <p className="mt-2 text-center text-xs tracking-wide text-lanta-charcoal/50 uppercase">
            Offline mode — using cached assignments
          </p>
        ) : null}

        {error ? (
          <p className={cn('text-center text-sm text-red-700', tvMode ? 'mt-6' : 'mt-10')} role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlay}
          tabIndex={0}
          data-tv-autofocus={canPlay ? 'true' : undefined}
          className={cn(
            'flex items-center justify-center rounded-full',
            'bg-lanta-taupe text-white shadow-md transition-transform',
            'hover:scale-105 hover:bg-lanta-taupe/90 active:scale-95',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
            tvMode ? 'mt-8 h-[5.5rem] w-[5.5rem]' : 'mt-10 h-20 w-20',
          )}
          aria-label="Play workout"
        >
          <svg
            viewBox="0 0 24 24"
            className={cn('ml-1 fill-current', tvMode ? 'h-10 w-10' : 'h-9 w-9')}
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        {tvMode ? (
          <>
            <p className="mt-5 text-center text-sm text-lanta-charcoal/50">
              Remote: ↓ / ↑ to move · OK to select
            </p>
            <button
              type="button"
              tabIndex={0}
              onClick={handleChangeTablet}
              className={cn(
                'mt-5 rounded-sm border border-lanta-sand bg-white/90 px-5 py-3',
                'text-xs font-medium tracking-[0.12em] text-lanta-charcoal uppercase',
                'hover:bg-white focus-visible:outline-none',
              )}
              aria-label="Change tablet"
            >
              Change tablet
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
