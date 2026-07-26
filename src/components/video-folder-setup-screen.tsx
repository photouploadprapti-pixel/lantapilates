'use client'

import { useEffect } from 'react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'

type VideoFolderSetupScreenProps = {
  onComplete: () => void
  isLoading: boolean
  error: string | null
  hasFolder: boolean
  folderName: string | null
  files: LocalVideoFile[]
  pickFolder: () => Promise<void>
}

/**
 * First-launch screen: asks the user to pick a folder containing workout videos.
 * Prefer the hardcoded Internal storage / LantaPilates folder on TV boxes.
 *
 * @param onComplete - Called when the selected folder contains at least one video
 * @param isLoading - True while the folder picker / scan is running
 * @param error - Last folder error message
 * @param hasFolder - Whether a folder path is stored
 * @param folderName - Display name of the selected folder
 * @param files - Videos discovered in the folder
 * @param pickFolder - Opens the native folder browser (or auto-binds LantaPilates)
 */
export const VideoFolderSetupScreen = ({
  onComplete,
  isLoading,
  error,
  hasFolder,
  folderName,
  files,
  pickFolder,
}: VideoFolderSetupScreenProps) => {
  useEffect(() => {
    if (hasFolder && files.length > 0) {
      onComplete()
    }
  }, [hasFolder, files.length, onComplete])

  if (hasFolder && files.length === 0 && !isLoading) {
    return (
      <AppShell
        title="No Videos Found"
        subtitle="Put your .ts / .mp4 workout videos in a folder named LantaPilates on Internal storage, then try again."
      >
        <div className="space-y-6">
          {folderName ? (
            <p className="rounded-sm border border-lanta-sand bg-white/80 p-4 text-sm text-lanta-charcoal/80">
              Current folder: <span className="font-medium">{folderName}</span>
            </p>
          ) : null}
          <p className="rounded-sm border border-lanta-sand bg-white/80 p-4 text-sm text-lanta-charcoal/80">
            Expected path:{' '}
            <span className="font-medium">Internal storage / LantaPilates</span>
          </p>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" onClick={() => void pickFolder()} disabled={isLoading}>
            {isLoading ? 'Looking for videos…' : 'Load LantaPilates folder'}
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Video Library"
      subtitle="Create a folder named LantaPilates on this device, copy your workout videos into it, then press the button below."
    >
      <div className="space-y-8">
        <div
          className={cn(
            'rounded-sm border border-lanta-sand bg-white/80 p-6',
            'text-sm leading-relaxed text-lanta-charcoal/80',
          )}
        >
          <p className="font-medium text-lanta-charcoal">Easiest setup</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              On the TV/tablet, create{' '}
              <span className="font-medium text-lanta-charcoal">LantaPilates</span> on Internal
              storage <span className="font-medium">or on your USB / pen drive</span>.
            </li>
            <li>Copy your .ts / .mp4 workout files into that folder.</li>
            <li>
              Press the button below — the app scans Internal storage and USB. Or open{' '}
              <span className="font-medium">USB · …</span> in the folder list.
            </li>
          </ol>
          <p className="mt-4 font-medium text-lanta-charcoal">Supported formats</p>
          <p className="mt-2">
            .ts (MPEG-TS), .mts, .m2ts, .mp4, .m4v, .webm, .mkv, .mov, .avi, and .3gp
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={() => void pickFolder()} disabled={isLoading}>
          {isLoading ? 'Looking for videos…' : 'Load LantaPilates / choose folder'}
        </Button>
      </div>
    </AppShell>
  )
}
