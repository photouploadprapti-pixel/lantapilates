'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { LantaLogo } from '@/components/lanta-logo'
import { OfflineSettingsPanel } from '@/components/offline-settings-panel'
import { VideoFolderSetupScreen } from '@/components/video-folder-setup-screen'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { useLocalVideos } from '@/hooks/use-local-videos'
import {
  loadOfflineAppSettings,
  saveOfflineAppSettings,
} from '@/lib/offline-app-settings'
import { findMatchingVideoName } from '@/lib/video-name-match'
import { saveTabletSession } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'

/**
 * Offline Android entry: folder setup → welcome → local playlist playback.
 * Play uses a large rectangular remote-friendly button (same style as online TV).
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
  } = useLocalVideos()
  const [settings, setSettings] = useState(loadOfflineAppSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [folderSetupDone, setFolderSetupDone] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)
  const setupError = error ?? folderError

  const canPlay =
    !isStarting
    && !isFolderLoading
    && Boolean(settings.userName.trim())
    && settings.selectedFileNames.length > 0
    && matchedReady(settings.selectedFileNames, files)

  useTvAutoFocus(isReady && (hasFolder ? canPlay : true) && !showSettings)

  useEffect(() => {
    setSettings(loadOfflineAppSettings())
  }, [hasFolder, files.length])

  // Auto-select every discovered video when none are chosen yet (common on first TV setup).
  useEffect(() => {
    if (files.length === 0) {
      return
    }

    const current = loadOfflineAppSettings()
    if (current.selectedFileNames.length > 0) {
      return
    }

    const nextNames = files.map((file) => file.name)
    saveOfflineAppSettings({ selectedFileNames: nextNames })
    setSettings(loadOfflineAppSettings())
  }, [files])

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

  const matchedCount = useMemo(
    () =>
      settings.selectedFileNames.filter((assigned) =>
        findMatchingVideoName(
          assigned,
          files.map((file) => file.name),
        ),
      ).length,
    [settings.selectedFileNames, files],
  )

  const handlePlay = () => {
    if (!settings.userName.trim()) {
      setError('Open settings and set a user name first.')
      setShowSettings(true)
      return
    }

    if (settings.selectedFileNames.length === 0) {
      setError('Open settings and select videos to play.')
      setShowSettings(true)
      return
    }

    if (!hasFolder || files.length === 0) {
      setError('Put videos in the LantaPilates folder, then refresh.')
      setFolderSetupDone(false)
      return
    }

    if (matchedCount === 0) {
      setError('None of the selected videos were found in LantaPilates.')
      return
    }

    setIsStarting(true)
    saveTabletSession({
      slug: 'tab1',
      userName: settings.userName.trim(),
      userId: 'offline-local',
      videoFileNames: settings.selectedFileNames,
      videoSource: 'local',
    })
    router.push('/tab1/play/')
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
        'relative flex min-h-dvh flex-col items-center justify-center bg-lanta-cream px-6',
        'pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]',
      )}
    >
      <div className="flex w-full max-w-lg flex-col items-center">
        <LantaLogo size="lg" />

        <p className="mt-6 text-center text-base leading-relaxed text-lanta-charcoal/70">
          On-demand reformer Pilates — your way, every day.
        </p>

        {isFolderLoading ? (
          <p className="mt-14 text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
        ) : settings.userName.trim() ? (
          <h1 className="mt-14 text-center font-display text-5xl leading-tight text-lanta-charcoal sm:text-6xl">
            Welcome {settings.userName.trim()}
          </h1>
        ) : (
          <h1 className="mt-14 text-center font-display text-4xl leading-tight text-lanta-charcoal">
            Welcome
          </h1>
        )}

        <p className="mt-4 text-center text-sm text-lanta-charcoal/60">
          Video folder:{' '}
          <span className="font-medium text-lanta-charcoal">{folderName ?? 'LantaPilates'}</span>
          {settings.selectedFileNames.length > 0 ? (
            <>
              {' · '}
              {matchedCount}/{settings.selectedFileNames.length} ready
            </>
          ) : null}
        </p>

        <p className="mt-2 text-center text-xs tracking-wide text-lanta-charcoal/50 uppercase">
          Offline mode
        </p>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-10 flex w-full max-w-md flex-col gap-4">
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
            onClick={() => setShowSettings(true)}
            tabIndex={0}
            className={cn(remoteButtonClass, 'h-14 text-base')}
            aria-label="Open settings"
          >
            Open settings
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-lanta-charcoal/50">
          Remote: ↑ / ↓ to move · OK to select
        </p>
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

/**
 * Checks whether every assigned name has a matching file in the library.
 *
 * @param selected - Assigned video file names
 * @param files - Discovered library files
 */
const matchedReady = (
  selected: string[],
  files: { name: string }[],
): boolean => {
  if (selected.length === 0 || files.length === 0) {
    return false
  }
  const names = files.map((file) => file.name)
  return selected.some((assigned) => Boolean(findMatchingVideoName(assigned, names)))
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
