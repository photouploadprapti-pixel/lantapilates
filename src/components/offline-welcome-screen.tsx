'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AssignedVideoGallery } from '@/components/assigned-video-gallery'
import { LantaLogo } from '@/components/lanta-logo'
import { OfflineSettingsPanel } from '@/components/offline-settings-panel'
import { VideoFolderSetupScreen } from '@/components/video-folder-setup-screen'
import { WelcomeCueCopy } from '@/components/welcome-cue-copy'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { useLocalVideos } from '@/hooks/use-local-videos'
import {
  loadOfflineAppSettings,
  saveOfflineAppSettings,
} from '@/lib/offline-app-settings'
import {
  buildOfflinePlaylist,
  mergeOfflinePlaylistOrder,
  offlineDisplayTitle,
  saveOfflinePlaylistOrder,
} from '@/lib/offline-playlist'
import { scrollPageToTop } from '@/lib/scroll-page-top'
import { saveTabletSession } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'

/**
 * Offline Android entry: folder setup → welcome → gallery / play local videos.
 * Playlist order and titles are stored on-device (no admin assignment).
 */
export const OfflineWelcomeScreen = () => {
  const router = useRouter()
  const {
    isReady,
    hasFolder,
    folderName,
    files,
    error: folderError,
    isLoading: isFolderLoading,
    changeFolder,
    refresh,
    renameVideo,
  } = useLocalVideos()
  const [settings, setSettings] = useState(loadOfflineAppSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [folderSetupDone, setFolderSetupDone] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  selectedIndexRef.current = selectedIndex
  const setupError = error ?? folderError

  const playlist = useMemo(() => buildOfflinePlaylist(files), [files, settings])
  const playableFiles = files.filter((file) => Boolean(file.playbackUrl))
  const canPlay =
    !isStarting
    && !isFolderLoading
    && Boolean(settings.userName.trim())
    && playableFiles.length > 0

  useTvAutoFocus(
    isReady && (hasFolder ? canPlay : true) && !showSettings && !galleryOpen,
  )

  useEffect(() => {
    setSettings(loadOfflineAppSettings())
  }, [hasFolder, files.length])

  useEffect(() => {
    scrollPageToTop()
  }, [])

  useEffect(() => {
    if (galleryOpen) {
      scrollPageToTop()
    }
  }, [galleryOpen])

  // Keep saved order in sync with the folder without wiping manual sorting.
  useEffect(() => {
    if (files.length === 0) {
      return
    }

    const discovered = files.map((file) => file.name)
    const current = loadOfflineAppSettings()
    const merged = mergeOfflinePlaylistOrder(current.selectedFileNames, discovered)
    const same =
      merged.length === current.selectedFileNames.length
      && merged.every((name, index) => name === current.selectedFileNames[index])

    if (same) {
      return
    }

    const saved = saveOfflinePlaylistOrder(merged)
    setSettings(saved)
  }, [files])

  useEffect(() => {
    setSelectedIndex((index) => {
      if (playlist.length === 0) {
        return 0
      }
      return Math.min(index, playlist.length - 1)
    })
  }, [playlist.length])

  const handleFolderComplete = useCallback(() => {
    setFolderSetupDone(true)
  }, [])

  const rescanLibrary = useCallback(async () => {
    setError(undefined)
    try {
      await changeFolder()
    } catch {
      await refresh()
    }
  }, [changeFolder, refresh])

  /**
   * Starts playback at the selected gallery / playlist index.
   *
   * @param index - Clip index to open first
   */
  const beginPlayback = (index: number) => {
    if (!settings.userName.trim()) {
      setError('Open settings and set a user name first.')
      setShowSettings(true)
      return
    }

    if (!hasFolder || playlist.length === 0) {
      setError('Put videos in the LantaPilates folder, then refresh.')
      setFolderSetupDone(false)
      return
    }

    const safeIndex = Math.min(Math.max(0, index), playlist.length - 1)
    const orderedNames = playlist.map((video) => video.fileName ?? video.title)
    const orderedTitles = playlist.map((video) => video.title)

    setIsStarting(true)
    saveOfflineAppSettings({ selectedFileNames: orderedNames })
    saveTabletSession({
      slug: 'tab1',
      userName: settings.userName.trim(),
      userId: 'offline-local',
      videoFileNames: orderedNames,
      videoTitles: orderedTitles,
      videoSource: 'local',
      startIndex: safeIndex,
    })
    router.push('/tab1/play/')
  }

  const handlePlay = () => {
    beginPlayback(selectedIndexRef.current)
  }

  /**
   * Renames a local video title and optionally the on-disk file name.
   *
   * @param index - Playlist index
   * @param nextTitle - New display title (or full file name)
   */
  const handleRenameAssigned = async (index: number, nextTitle: string) => {
    const video = playlist[index]
    if (!video?.fileName || !nextTitle.trim()) {
      return
    }

    const trimmed = nextTitle.trim()
    const looksLikeFileName = /\.(mp4|m4v|webm|mov|ts|mts|m2ts|mkv)$/i.test(trimmed)
    const current = loadOfflineAppSettings()

    if (looksLikeFileName && trimmed !== video.fileName) {
      try {
        await renameVideo(video.fileName, trimmed)
        const titles = { ...current.videoTitles }
        delete titles[video.fileName]
        titles[trimmed] = offlineDisplayTitle(trimmed)
        const names = current.selectedFileNames.map((name) =>
          name === video.fileName ? trimmed : name,
        )
        const saved = saveOfflineAppSettings({
          selectedFileNames: names,
          videoTitles: titles,
        })
        setSettings(saved)
        setError(undefined)
        return
      } catch (renameError) {
        setError(
          renameError instanceof Error
            ? renameError.message
            : 'Could not rename the video file',
        )
        return
      }
    }

    const saved = saveOfflineAppSettings({
      videoTitles: {
        ...current.videoTitles,
        [video.fileName]: trimmed,
      },
    })
    setSettings(saved)
  }

  /**
   * Moves a gallery item earlier or later in the offline playlist.
   *
   * @param index - Current index
   * @param direction - -1 earlier, +1 later
   */
  const handleMoveAssigned = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= playlist.length) {
      return
    }

    const names = playlist.map((video) => video.fileName ?? video.title)
    const [moved] = names.splice(index, 1)
    if (!moved) {
      return
    }
    names.splice(nextIndex, 0, moved)
    const saved = saveOfflinePlaylistOrder(names)
    setSettings(saved)
    setSelectedIndex(nextIndex)
  }

  if (isReady && (!hasFolder || files.length === 0) && !folderSetupDone) {
    return (
      <VideoFolderSetupScreen
        onComplete={handleFolderComplete}
        isLoading={isFolderLoading}
        error={setupError ?? null}
        hasFolder={hasFolder}
        folderName={folderName}
        files={files}
        pickFolder={rescanLibrary}
      />
    )
  }

  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col bg-lanta-cream',
        galleryOpen
          ? 'items-stretch px-4 py-6 sm:px-8'
          : cn(
            'items-center justify-center px-6',
            'pb-[max(2rem,env(safe-area-inset-bottom))]',
            'pt-[max(2rem,env(safe-area-inset-top))]',
          ),
      )}
    >
      <div
        className={cn(
          galleryOpen
            ? 'mx-auto flex w-full max-w-6xl flex-col'
            : 'flex w-full max-w-lg flex-col items-center',
        )}
      >
        {!galleryOpen ? (
          <>
            <LantaLogo size="lg" />

            {isFolderLoading ? (
              <p className="mt-14 text-sm tracking-wide text-lanta-charcoal/60 uppercase">
                Loading…
              </p>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p className="mt-6 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {galleryOpen ? (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
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
              canEdit
              onSelectedIndexChange={setSelectedIndex}
              onActivate={beginPlayback}
              onRename={handleRenameAssigned}
              onMove={handleMoveAssigned}
            />
            <p className="mt-6 text-center text-sm text-lanta-charcoal/60">
              Tap a video to play. Use Rename / Up / Down to edit the list.
              For a file rename, include the extension (for example .mp4).
            </p>
          </div>
        ) : (
          <div className="mt-14 flex w-full max-w-md flex-col gap-4">
            {!isFolderLoading ? <WelcomeCueCopy className="mb-1" /> : null}
            <button
              type="button"
              onClick={handlePlay}
              disabled={!canPlay}
              data-tv-autofocus={canPlay ? 'true' : undefined}
              tabIndex={0}
              className={cn(remoteButtonClass, 'h-[4.5rem] text-xl font-semibold')}
              aria-label="Play workout"
            >
              {isStarting ? 'Starting…' : 'Play'}
            </button>

            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              disabled={playlist.length === 0 || isFolderLoading}
              tabIndex={0}
              className={cn(remoteButtonClass, 'h-14 text-base')}
              aria-label="View as gallery"
            >
              View as gallery
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              tabIndex={0}
              className={cn(remoteButtonClass, 'h-14 text-base')}
              aria-label="Open settings"
            >
              Open settings
            </button>
          </div>
        )}

      </div>

      {showSettings ? (
        <OfflineSettingsPanel
          settings={settings}
          files={files}
          folderName={folderName}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            const saved = saveOfflineAppSettings(next)
            setSettings(saved)
            setError(undefined)
            setShowSettings(false)
          }}
        />
      ) : null}
    </div>
  )
}

/** Large rectangular control — easy D-pad focus target (matches online TV buttons). */
const remoteButtonClass = cn(
  'flex w-full items-center justify-center rounded-sm',
  'bg-[#E8E0D6] text-[#1A1A1A] tracking-wide uppercase',
  'border-2 border-[#E8DFD7] shadow-sm transition-colors',
  'hover:bg-[#F2EDE8]',
  'focus:border-lanta-taupe focus:bg-[#F2EDE8] focus:outline-none',
  'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
