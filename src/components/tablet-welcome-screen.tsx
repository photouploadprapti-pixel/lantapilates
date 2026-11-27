'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AdminLoginButton } from '@/components/admin-login-button'
import { AssignedVideoGallery } from '@/components/assigned-video-gallery'
import { LantaLogo } from '@/components/lanta-logo'
import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { WelcomeCueCopy } from '@/components/welcome-cue-copy'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { getHostedVideoUrl } from '@/lib/hosted-videos'
import { adminApi, isAdminAuthenticated } from '@/lib/admin-session'
import { clearHostedVideoPreloads } from '@/lib/hosted-video-preload'
import { isTvApp } from '@/lib/is-tv-app'
import { titleFromFileName } from '@/lib/local-video-catalog'
import {
  loadOfflineTabletSession,
  saveOfflineTabletSession,
} from '@/lib/offline-tablet-session'
import { fetchTabletSession } from '@/lib/tablet-data'
import { scrollPageToTop } from '@/lib/scroll-page-top'
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
  const [tvMode, setTvMode] = useState(false)
  const [showTvPlayer, setShowTvPlayer] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playToken, setPlayToken] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const selectedIndexRef = useRef(0)
  const galleryOpenRef = useRef(false)
  selectedIndexRef.current = selectedIndex
  galleryOpenRef.current = galleryOpen

  const canPlay = Boolean(
    userName && userId && videoFileNames.length > 0 && !isLoading && !isStarting,
  )
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
    setIsAdmin(isAdminAuthenticated())
    scrollPageToTop()
  }, [])

  useEffect(() => {
    setSelectedIndex((index) => {
      if (videoFileNames.length === 0) {
        return 0
      }
      return Math.min(index, videoFileNames.length - 1)
    })
  }, [videoFileNames.length])

  /**
   * Starts inline TV playback at the highlighted gallery card.
   * The player autoplays the following assigned videos when each one ends.
   */
  const startInlineTvPlayback = (): string => {
    if (!userName || !userId) {
      return 'no-user'
    }
    if (videoFileNames.length === 0) {
      return 'no-videos'
    }

    const index = selectedIndexRef.current
    saveTabletSession({
      slug,
      userName,
      userId,
      videoFileNames,
      videoTitles,
      videoSource: 'hosted',
      startIndex: index,
    })

    clearHostedVideoPreloads()

    setIsStarting(false)
    setPlayToken((token) => token + 1)
    setShowTvPlayer(true)
    document.body.classList.add('tv-playback')

    // Kick audible playback on the next frame without waiting for full buffer.
    requestAnimationFrame(() => {
      const element = document.querySelector('[data-tv-playback="true"] video')
      if (element instanceof HTMLVideoElement) {
        element.muted = false
        void element.play().catch(() => {
          // Autoplay may still need the native Play/Pause control.
        })
      }
    })

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
    scrollPageToTop()

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

    // Native bar inset can reflow the WebView after the bridge returns — scroll again.
    window.setTimeout(() => scrollPageToTop(), 300)

    return 'ok'
  }

  // Keep welcome pinned to the top whenever the inline player closes.
  useEffect(() => {
    if (showTvPlayer) {
      return
    }
    scrollPageToTop()
  }, [showTvPlayer])

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
            startIndex: selectedIndexRef.current,
          }
        : undefined

    window.__lantaTvStartPlay = () => startInlineTvPlayback()
    window.__lantaTvExitPlay = () => exitInlineTvPlayback()
    window.__lantaTvOpenGallery = () => {
      if (videoFileNames.length === 0) {
        return 'no-videos'
      }
      setGalleryOpen(true)
      return 'ok'
    }
    window.__lantaTvCloseGallery = () => {
      if (!galleryOpenRef.current) {
        return 'none'
      }
      setGalleryOpen(false)
      return 'closed'
    }

    return () => {
      delete window.__lantaTvSession
      delete window.__lantaTvStartPlay
      delete window.__lantaTvExitPlay
      delete window.__lantaTvOpenGallery
      delete window.__lantaTvCloseGallery
    }
  }, [tvMode, slug, userName, userId, videoFileNames, videoTitles, selectedIndex])

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
            setUserName(cached.userName)
            setVideoFileNames(cached.videoFileNames)
            setVideoTitles(cached.videoFileNames)
            setUserId(cached.userId)
            return
          }

          setError('No user assigned to this reformer yet. Ask your admin to assign one.')
          setUserName(null)
          setVideoFileNames([])
          setVideoTitles([])
          setUserId(null)
          return
        }

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
          setUserName(cached.userName)
          setVideoFileNames(cached.videoFileNames)
          setVideoTitles(cached.videoFileNames)
          setUserId(cached.userId)
          setError(undefined)
          return
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Could not load reformer settings',
        )
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

  /**
   * Opens the current player at one assigned video. Later videos autoplay.
   *
   * @param index - Playlist index chosen from the gallery
   */
  const beginPlayback = (index: number) => {
    if (!userName || !userId) {
      return
    }

    if (videoFileNames.length === 0) {
      setError('No videos assigned yet. Ask your admin to assign videos.')
      return
    }

    const safeIndex = Math.min(Math.max(0, index), videoFileNames.length - 1)
    selectedIndexRef.current = safeIndex
    setSelectedIndex(safeIndex)

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
      startIndex: safeIndex,
    })
    router.push(getTabletPlayPath(slug))
  }

  const handlePlay = () => {
    beginPlayback(selectedIndexRef.current)
  }

  /**
   * Highlights a gallery card and keeps the native Play button in sync immediately.
   *
   * @param index - Card index
   */
  const selectVideo = (index: number) => {
    selectedIndexRef.current = index
    setSelectedIndex(index)
  }

  const showGallery = galleryOpen && playlist.length > 0 && !showTvPlayer

  /**
   * Opens the catalog of assigned videos without starting playback.
   */
  const openGallery = () => {
    if (videoFileNames.length === 0) {
      setError('No videos assigned yet. Ask your admin to assign videos.')
      return
    }
    setGalleryOpen(true)
  }

  /**
   * Returns from the gallery to the welcome screen and the Play button.
   */
  const closeGallery = () => {
    setGalleryOpen(false)
    try {
      window.LantaTV?.focusWelcomePlay?.()
    } catch {
      // Bridge exists only inside the Android TV shell.
    }
  }

  /**
   * Saves a new display title for one assigned video (admin gallery edit).
   *
   * @param index - Playlist index
   * @param nextTitle - New title text
   */
  const handleRenameAssigned = async (index: number, nextTitle: string) => {
    if (!userId || !nextTitle.trim()) {
      return
    }

    const titles = videoFileNames.map((fileName, fileIndex) => {
      if (fileIndex === index) {
        return nextTitle.trim()
      }
      return videoTitles[fileIndex] ?? fileName
    })

    setVideoTitles(titles)
    try {
      await adminApi({
        action: 'setUserVideos',
        userId,
        fileNames: videoFileNames,
        titles,
      })
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename video')
    }
  }

  /**
   * Moves an assigned video earlier or later in the playlist (admin gallery edit).
   *
   * @param index - Current playlist index
   * @param direction - -1 for earlier, +1 for later
   */
  const handleMoveAssigned = async (index: number, direction: -1 | 1) => {
    if (!userId) {
      return
    }

    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= videoFileNames.length) {
      return
    }

    const nextNames = [...videoFileNames]
    const nextTitles = videoFileNames.map(
      (fileName, fileIndex) => videoTitles[fileIndex] ?? fileName,
    )
    const [movedName] = nextNames.splice(index, 1)
    const [movedTitle] = nextTitles.splice(index, 1)
    if (!movedName || movedTitle === undefined) {
      return
    }
    nextNames.splice(nextIndex, 0, movedName)
    nextTitles.splice(nextIndex, 0, movedTitle)

    setVideoFileNames(nextNames)
    setVideoTitles(nextTitles)
    setSelectedIndex(nextIndex)

    try {
      await adminApi({
        action: 'setUserVideos',
        userId,
        fileNames: nextNames,
        titles: nextTitles,
      })
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Could not reorder videos')
    }
  }

  return (
    <div
      className={cn(
        'relative bg-lanta-cream',
        tvMode ? 'tv-welcome-screen' : null,
        tvMode && showGallery ? 'tv-welcome-with-gallery' : null,
        !tvMode && showGallery ? 'min-h-dvh overflow-y-auto px-4 py-6 sm:px-8' : null,
        !tvMode && !showGallery
          ? cn(
            'flex min-h-dvh flex-col items-center justify-center px-6',
            'pb-[max(2rem,env(safe-area-inset-bottom))]',
            'pt-[max(2rem,env(safe-area-inset-top))]',
          )
          : null,
        showTvPlayer ? 'overflow-hidden bg-black' : null,
      )}
    >
      {showTvPlayer && playlist.length > 0 ? (
        <div className="fixed inset-0 z-50 bg-black">
          <NativePlaylistPlayer
            key={playToken}
            videos={playlist}
            startIndex={selectedIndex}
            className="h-full w-full"
            hideChrome={tvMode}
            autoPlay
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
          tvMode
            ? 'tv-welcome-stack'
            : showGallery
              ? 'mx-auto flex w-full max-w-6xl flex-col'
              : 'flex w-full max-w-md flex-col items-center',
          showTvPlayer ? 'hidden' : null,
        )}
      >
        {!showGallery ? (
          <div className="flex flex-col items-center">
            <LantaLogo
              size={tvMode ? 'xl' : 'lg'}
              className={tvMode ? 'tv-welcome-logo' : undefined}
            />

            {isLoading ? (
              <p
                className={cn(
                  'tracking-wide text-lanta-charcoal/60 uppercase',
                  tvMode ? 'tv-welcome-meta' : 'mt-2 text-sm',
                )}
              >
                Loading…
              </p>
            ) : (
              <>
                {userName ? (
                  <h1
                    className={
                      tvMode
                        ? 'tv-welcome-title'
                        : cn(
                          'text-center font-display text-5xl leading-tight',
                          'text-lanta-charcoal sm:text-6xl',
                        )
                    }
                  >
                    Welcome {userName}
                  </h1>
                ) : null}
                {tvMode ? <WelcomeCueCopy className="tv-welcome-cue" /> : null}
              </>
            )}
          </div>
        ) : null}

        {showGallery ? (
          <div className={tvMode ? 'tv-gallery-scroll' : 'mt-2 w-full'}>
            <button
              type="button"
              onClick={closeGallery}
              className={cn(
                'tv-gallery-back mb-4 inline-flex items-center rounded-sm border-2',
                'border-lanta-sand bg-white/90 px-4 py-2',
                'text-sm font-medium tracking-[0.12em] text-lanta-charcoal uppercase',
                'hover:bg-white focus:outline-none',
                'focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
              )}
            >
              Back
            </button>
            <AssignedVideoGallery
              videos={playlist}
              selectedIndex={selectedIndex}
              tvMode={tvMode}
              canEdit={isAdmin && !tvMode}
              onSelectedIndexChange={selectVideo}
              onActivate={beginPlayback}
              onRename={handleRenameAssigned}
              onMove={handleMoveAssigned}
            />
          </div>
        ) : null}

        {error ? (
          <p
            className={cn(
              'text-center text-red-700',
              tvMode ? 'tv-welcome-meta' : 'mt-10 text-sm',
            )}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!showGallery ? (
          <div className="mt-10 flex w-full flex-col items-center gap-4">
            {!isLoading && !tvMode ? <WelcomeCueCopy /> : null}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {!tvMode ? (
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={!canPlay}
                  tabIndex={0}
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-full',
                    'bg-lanta-taupe text-white shadow-md transition-transform',
                    'hover:scale-105 hover:bg-lanta-taupe/90 active:scale-95',
                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
                    'focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-lanta-taupe/50',
                  )}
                  aria-label="Play workout"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="ml-1 h-9 w-9 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={openGallery}
                disabled={isLoading || videoFileNames.length === 0}
                tabIndex={0}
                className={cn(
                  'rounded-full border-2 border-lanta-taupe bg-white px-6 py-3',
                  'text-sm font-medium tracking-[0.08em] text-lanta-charcoal',
                  'hover:bg-lanta-sand/40',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-lanta-taupe/50',
                  tvMode ? 'tv-welcome-gallery-button' : null,
                )}
              >
                View as gallery
              </button>
            </div>
          </div>
        ) : null}

        {!tvMode && showGallery ? (
          <p className="mt-6 text-center text-sm text-lanta-charcoal/60">
            Tap a video to play. The next one starts automatically.
          </p>
        ) : null}

        {tvMode && showGallery ? (
          <p className="tv-welcome-hint">
            Arrows choose a video · OK plays · the next video starts automatically
          </p>
        ) : null}
      </div>
    </div>
  )
}
