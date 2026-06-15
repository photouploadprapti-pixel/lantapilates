'use client'

import { useState } from 'react'

import type { WorkoutVideo } from '@/types/workout-video'

import { getVideoThumbnailUrl } from '@/lib/video-playback'
import { cn } from '@/lib/utils'

type WorkoutVideoListItemProps = {
  video: WorkoutVideo
  onSelect: () => void
}

/**
 * Tappable row for a single workout video with a Drive thumbnail preview.
 */
export const WorkoutVideoListItem = ({ video, onSelect }: WorkoutVideoListItemProps) => {
  const thumbnailUrl = getVideoThumbnailUrl(video.source)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-4 rounded-sm border border-lanta-sand bg-white/80 p-3',
        'text-left transition-colors min-h-[5.5rem] active:scale-[0.99] hover:bg-white',
      )}
    >
      <span
        className={cn(
          'relative shrink-0 overflow-hidden rounded-sm border border-lanta-sand',
          'h-[4.5rem] w-[5.5rem] bg-lanta-sand/50',
        )}
      >
        {thumbnailUrl && !thumbnailFailed ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-xs text-lanta-charcoal/40"
            aria-hidden="true"
          >
            Video
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block font-medium leading-snug text-lanta-charcoal">
          {video.title}
        </span>
        {video.description ? (
          <span className="mt-1 block text-sm leading-relaxed text-lanta-charcoal/65">
            {video.description}
          </span>
        ) : null}
        {video.durationLabel ? (
          <span className="mt-2 block text-xs tracking-[0.12em] text-lanta-sage uppercase">
            {video.durationLabel}
          </span>
        ) : null}
      </span>
    </button>
  )
}
