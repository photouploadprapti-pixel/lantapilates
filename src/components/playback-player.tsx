'use client'

import { DrivePlaylistPlayer } from '@/components/drive-playlist-player'
import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type PlaybackMode = 'native' | 'drive-embed'

type PlaybackPlayerProps = {
  className?: string
  videos?: LocalPlaylistVideo[]
  isResolving?: boolean
  emptyMessage?: string
  /** `drive-embed` uses Google Drive preview; `native` uses local / mpegts playback */
  playbackMode?: PlaybackMode
}

/**
 * Plays admin-assigned videos from Drive (embed) or a local offline folder (native).
 *
 * @param videos - Resolved playlist entries
 * @param isResolving - True while matching assigned names to local files
 * @param emptyMessage - Message when no playable videos are available
 * @param playbackMode - Drive embed vs native local player
 */
export const PlaybackPlayer = ({
  className,
  videos,
  isResolving = false,
  emptyMessage = 'No local videos ready to play.',
  playbackMode = 'native',
}: PlaybackPlayerProps) => {
  if (isResolving) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-black', className)}>
        <p className="text-sm tracking-wide text-white/70 uppercase">Loading videos…</p>
      </div>
    )
  }

  if (videos && videos.length > 0) {
    if (playbackMode === 'drive-embed') {
      return <DrivePlaylistPlayer videos={videos} className={className} />
    }

    return <NativePlaylistPlayer videos={videos} className={className} />
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-black px-6', className)}>
      <p className="max-w-md text-center text-sm text-white/70">{emptyMessage}</p>
    </div>
  )
}
