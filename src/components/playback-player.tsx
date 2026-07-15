'use client'

import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type PlaybackPlayerProps = {
  className?: string
  videos?: LocalPlaylistVideo[]
  isResolving?: boolean
  emptyMessage?: string
}

/**
 * Plays admin-assigned local videos from the selected offline folder.
 * YouTube playback is paused — local file names are the source of truth.
 *
 * @param videos - Resolved local playlist entries matched by file name
 * @param isResolving - True while matching assigned names to local files
 * @param emptyMessage - Message when no playable videos are available
 */
export const PlaybackPlayer = ({
  className,
  videos,
  isResolving = false,
  emptyMessage = 'No local videos ready to play.',
}: PlaybackPlayerProps) => {
  if (isResolving) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-black', className)}>
        <p className="text-sm tracking-wide text-white/70 uppercase">Loading videos…</p>
      </div>
    )
  }

  if (videos && videos.length > 0) {
    return <NativePlaylistPlayer videos={videos} className={className} />
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-black px-6', className)}>
      <p className="max-w-md text-center text-sm text-white/70">{emptyMessage}</p>
    </div>
  )
}
