'use client'

import type { WorkoutVideo } from '@/types/workout-video'

import { getVideoEmbedUrl, getVideoStreamUrl } from '@/lib/video-playback'
import { cn } from '@/lib/utils'

type WorkoutVideoPlayerProps = {
  video: WorkoutVideo
  className?: string
}

/**
 * Plays a workout video from Google Drive (sandboxed iframe) or local storage (`<video>`).
 * Drive pop-out is blocked via sandbox + top-right overlay.
 */
export const WorkoutVideoPlayer = ({ video, className }: WorkoutVideoPlayerProps) => {
  const embedUrl = getVideoEmbedUrl(video.source)
  const streamUrl = getVideoStreamUrl(video.source)

  if (video.source.type === 'google-drive' && embedUrl) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-sm border border-lanta-sand bg-black shadow-sm',
          className,
        )}
      >
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={video.title}
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className="absolute inset-0 h-full w-full border-0"
          />
          {/* Blocks Drive pop-out control; sandbox prevents new-tab navigation */}
          <div
            className="absolute right-0 top-0 z-10 h-16 w-16 bg-black"
            aria-hidden="true"
          />
        </div>
      </div>
    )
  }

  if (video.source.type === 'local' && streamUrl) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-sm border border-lanta-sand bg-black shadow-sm',
          className,
        )}
      >
        <video
          src={streamUrl}
          title={video.title}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex aspect-video items-center justify-center rounded-sm border border-lanta-sand',
        'bg-white/80 px-6 text-center text-sm text-lanta-charcoal/70',
        className,
      )}
    >
      Video playback is not available for this source yet.
    </div>
  )
}
