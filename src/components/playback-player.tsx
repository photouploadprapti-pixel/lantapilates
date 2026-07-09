'use client'

import { YouTubeVideoPlayer } from '@/components/youtube-video-player'
import { LANTA_REFORMER_PLAYLIST_ID } from '@/lib/youtube-playlist'
import { cn } from '@/lib/utils'

type PlaybackPlayerProps = {
  className?: string
  videoIds?: string[]
}

/**
 * Streams assigned YouTube videos or the default reformer playlist.
 * @param videoIds - Admin-assigned video ids for the active tablet user
 */
export const PlaybackPlayer = ({ className, videoIds }: PlaybackPlayerProps) => {
  if (videoIds && videoIds.length > 0) {
    return <YouTubeVideoPlayer videoIds={videoIds} className={className} />
  }

  return (
    <YouTubeVideoPlayer playlistId={LANTA_REFORMER_PLAYLIST_ID} className={className} />
  )
}
