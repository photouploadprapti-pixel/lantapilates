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
 * Offline setup: waits for the fixed LantaPilates library folder (no folder picker).
 *
 * @param onComplete - Called when videos are found in LantaPilates
 * @param isLoading - True while scanning
 * @param error - Last scan error
 * @param hasFolder - Whether LantaPilates was found
 * @param folderName - Display name (usually LantaPilates)
 * @param files - Discovered videos
 * @param pickFolder - Re-scans the fixed LantaPilates folder
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

  return (
    <AppShell
      title={hasFolder && files.length === 0 ? 'No Videos Found' : 'LantaPilates Library'}
      subtitle="Put your workout videos in a folder named LantaPilates on Internal storage or your USB drive. The app always uses that folder."
    >
      <div className="space-y-8">
        <div
          className={cn(
            'rounded-sm border border-lanta-sand bg-white/80 p-6',
            'text-sm leading-relaxed text-lanta-charcoal/80',
          )}
        >
          <p className="font-medium text-lanta-charcoal">Fixed folder</p>
          <p className="mt-2">
            <span className="font-medium text-lanta-charcoal">LantaPilates</span>
            {folderName ? (
              <>
                {' '}
                (found: <span className="font-medium">{folderName}</span>)
              </>
            ) : (
              ' — not found yet'
            )}
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            <li>Create a folder named LantaPilates on Internal storage or USB.</li>
            <li>Copy .mp4 workout files into it (recommended).</li>
            <li>Allow &quot;All files access&quot; for this app if Android asks.</li>
            <li>Press Refresh below.</li>
          </ol>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={() => void pickFolder()} disabled={isLoading}>
          {isLoading ? 'Scanning LantaPilates…' : 'Refresh LantaPilates folder'}
        </Button>
      </div>
    </AppShell>
  )
}
