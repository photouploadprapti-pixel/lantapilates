'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { LantaLogo } from '@/components/lanta-logo'
import { OfflineSettingsPanel } from '@/components/offline-settings-panel'
import { VideoFolderSetupScreen } from '@/components/video-folder-setup-screen'
import { Button } from '@/components/ui/button'
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
 */
export const OfflineWelcomeScreen = () => {
  const router = useRouter()
  const {
    isReady,
    hasFolder,
    folderName,
    files,
    isLoading: isFolderLoading,
    changeFolder,
  } = useLocalVideos()
  const [settings, setSettings] = useState(loadOfflineAppSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [folderSetupDone, setFolderSetupDone] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    setSettings(loadOfflineAppSettings())
  }, [hasFolder, files.length])

  const handleFolderComplete = useCallback(() => {
    setFolderSetupDone(true)
  }, [])

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
      setError('Open the menu and set a user name first.')
      setShowSettings(true)
      return
    }

    if (settings.selectedFileNames.length === 0) {
      setError('Open the menu and select videos to play.')
      setShowSettings(true)
      return
    }

    if (!hasFolder || files.length === 0) {
      setError('Select a video folder first.')
      setFolderSetupDone(false)
      return
    }

    if (matchedCount === 0) {
      setError('None of the selected videos were found in the folder.')
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
    return <VideoFolderSetupScreen onComplete={handleFolderComplete} />
  }

  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col items-center justify-center bg-lanta-cream px-6',
        'pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]',
      )}
    >
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className={cn(
          'absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20',
          'flex h-11 w-11 items-center justify-center rounded-full',
          'bg-white/90 text-lanta-charcoal shadow-md',
          'hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
        )}
        aria-label="Open settings menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex w-full max-w-md flex-col items-center">
        <LantaLogo size="lg" />

        <p className="mt-6 text-center text-base leading-relaxed text-lanta-charcoal/70">
          On-demand reformer Pilates — your way, every day.
        </p>

        {isFolderLoading ? (
          <p className="mt-16 text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
        ) : settings.userName.trim() ? (
          <h1 className="mt-16 text-center font-display text-5xl leading-tight text-lanta-charcoal sm:text-6xl">
            Welcome {settings.userName.trim()}
          </h1>
        ) : (
          <h1 className="mt-16 text-center font-display text-4xl leading-tight text-lanta-charcoal">
            Welcome
          </h1>
        )}

        {folderName ? (
          <p className="mt-4 text-center text-sm text-lanta-charcoal/60">
            Video folder: <span className="font-medium text-lanta-charcoal">{folderName}</span>
            {settings.selectedFileNames.length > 0 ? (
              <>
                {' · '}
                {matchedCount}/{settings.selectedFileNames.length} ready
              </>
            ) : null}
          </p>
        ) : null}

        <p className="mt-2 text-center text-xs tracking-wide text-lanta-charcoal/50 uppercase">
          Offline mode
        </p>

        {error ? (
          <p className="mt-8 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlay}
          disabled={
            isStarting ||
            isFolderLoading ||
            !settings.userName.trim() ||
            settings.selectedFileNames.length === 0 ||
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
          onClick={() => setShowSettings(true)}
        >
          Open settings
        </Button>
      </div>

      {showSettings ? (
        <OfflineSettingsPanel
          settings={settings}
          files={files}
          folderName={folderName}
          onClose={() => setShowSettings(false)}
          onChangeFolder={() => {
            setShowSettings(false)
            void changeFolder()
          }}
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

type IconProps = {
  className?: string
}

const MenuIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
  </svg>
)
