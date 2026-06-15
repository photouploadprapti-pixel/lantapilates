'use client'

import type { WorkoutVideo } from '@/types/workout-video'

import { getVideoStreamUrl } from '@/lib/video-playback'
import { cn } from '@/lib/utils'

type WorkoutVideoPlayerProps = {
  video: WorkoutVideo
  className?: string
}

/**
 * Plays a workout video via native HTML5 controls (no Drive iframe or pop-out UI).
 */
export const WorkoutVideoPlayer = ({ video, className }: WorkoutVideoPlayerProps) => {
  const streamUrl = getVideoStreamUrl(video.source)

  if (streamUrl) {
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
          onContextMenu={(event) => event.preventDefault()}
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
