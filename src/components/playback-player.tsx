'use client'

import { YouTubeVideoPlayer } from '@/components/youtube-video-player'
import { LANTA_REFORMER_PLAYLIST_ID } from '@/lib/youtube-playlist'
import { cn } from '@/lib/utils'

type PlaybackPlayerProps = {
  className?: string
}

/**
 * Streams the reformer playlist from YouTube with a custom in-app player.
 */
export const PlaybackPlayer = ({ className }: PlaybackPlayerProps) => (
  <YouTubeVideoPlayer playlistId={LANTA_REFORMER_PLAYLIST_ID} className={className} />
)
