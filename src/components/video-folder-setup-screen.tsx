'use client'

import { useEffect } from 'react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { cn } from '@/lib/utils'

type VideoFolderSetupScreenProps = {
  onComplete: () => void
}

/**
 * First-launch screen: asks the user to pick a folder containing workout videos.
 */
export const VideoFolderSetupScreen = ({ onComplete }: VideoFolderSetupScreenProps) => {
  const { isLoading, error, hasFolder, folderName, files, pickFolder } = useLocalVideos()

  useEffect(() => {
    if (hasFolder && files.length > 0) {
      onComplete()
    }
  }, [hasFolder, files.length, onComplete])

  if (hasFolder && files.length === 0 && !isLoading) {
    return (
      <AppShell
        title="No Videos Found"
        subtitle="The folder you selected does not contain any supported video files. Choose another folder with your workout videos."
      >
        <div className="space-y-6">
          {folderName ? (
            <p className="rounded-sm border border-lanta-sand bg-white/80 p-4 text-sm text-lanta-charcoal/80">
              Current folder: <span className="font-medium">{folderName}</span>
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" onClick={() => void pickFolder()} disabled={isLoading}>
            {isLoading ? 'Opening file manager…' : 'Choose another folder'}
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Video Library"
      subtitle="Select the folder on this device that contains your Pilates workout videos. Use the same file names assigned by your admin."
    >
      <div className="space-y-8">
        <div
          className={cn(
            'rounded-sm border border-lanta-sand bg-white/80 p-6',
            'text-sm leading-relaxed text-lanta-charcoal/80',
          )}
        >
          <p className="font-medium text-lanta-charcoal">Supported formats</p>
          <p className="mt-2">
            .ts (MPEG-TS), .mts, .m2ts, .mp4, .m4v, .webm, .mkv, .mov, .avi, and .3gp
            files in the selected folder.
          </p>
          <p className="mt-4 font-medium text-lanta-charcoal">How it works</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>Tap the button below to open your file manager.</li>
            <li>Select the folder where your videos are stored.</li>
            <li>Only videos assigned to you by name will play.</li>
          </ol>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={() => void pickFolder()} disabled={isLoading}>
          {isLoading ? 'Opening file manager…' : 'Select video folder'}
        </Button>
      </div>
    </AppShell>
  )
}
