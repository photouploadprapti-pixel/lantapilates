'use client'

import { useEffect, useRef, useState } from 'react'

import { VideoPreviewThumb } from '@/components/video-preview-thumb'
import {
  formatGalleryDuration,
  galleryDisplayTitle,
  getGalleryBadge,
  type GalleryBadgeTone,
} from '@/lib/video-gallery'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type GalleryDirection = 'left' | 'right' | 'up' | 'down'

type AssignedVideoGalleryProps = {
  videos: LocalPlaylistVideo[]
  selectedIndex: number
  tvMode?: boolean
  onSelectedIndexChange: (index: number) => void
  /** Opens the existing player at this clip. */
  onActivate: (index: number) => void
}

const TONE_CLASS: Record<GalleryBadgeTone, string> = {
  beginner: 'bg-emerald-500',
  stretch: 'bg-rose-500',
  matwork: 'bg-teal-500',
  finisher: 'bg-lime-600',
  intermediate: 'bg-amber-500',
  cardio: 'bg-orange-500',
  athletic: 'bg-sky-600',
  intro: 'bg-lanta-sage',
}

const DIRECTIONS: readonly GalleryDirection[] = ['left', 'right', 'up', 'down']

/**
 * Returns true when a native-shell message is a D-pad direction.
 *
 * @param value - Raw direction string
 */
const isGalleryDirection = (value: string): value is GalleryDirection =>
  (DIRECTIONS as readonly string[]).includes(value)

/**
 * Catalog-style grid of the videos assigned to this tablet.
 * Thumbnails are real frames from each file, with a class badge and length.
 *
 * @param videos - Assigned playlist, in admin order
 * @param selectedIndex - Clip the remote Play / OK action will start
 * @param tvMode - Enables the D-pad bridge used by the Android TV shell
 * @param onSelectedIndexChange - Updates the highlighted card
 * @param onActivate - Starts playback at a card
 */
export const AssignedVideoGallery = ({
  videos,
  selectedIndex,
  tvMode = false,
  onSelectedIndexChange,
  onActivate,
}: AssignedVideoGalleryProps) => {
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedRef = useRef(selectedIndex)
  const onSelectedIndexChangeRef = useRef(onSelectedIndexChange)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [armedCount, setArmedCount] = useState(() => Math.min(2, videos.length))
  selectedRef.current = selectedIndex
  onSelectedIndexChangeRef.current = onSelectedIndexChange

  useEffect(() => {
    setArmedCount(Math.min(2, videos.length))
  }, [videos])

  useEffect(() => {
    if (armedCount >= videos.length) {
      return
    }
    const timer = window.setTimeout(() => {
      setArmedCount((count) => Math.min(videos.length, count + 1))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [armedCount, videos.length])

  useEffect(() => {
    if (!tvMode) {
      return
    }

    /**
     * Moves the highlight to the nearest card in a D-pad direction.
     *
     * @param direction - left, right, up, or down
     */
    const moveSelection = (direction: GalleryDirection): string => {
      const currentIndex = selectedRef.current
      cardRefs.current.length = videos.length
      const current = cardRefs.current[currentIndex]
      if (!current) {
        return 'none'
      }

      const currentRect = current.getBoundingClientRect()
      const originX = currentRect.left + currentRect.width / 2
      const originY = currentRect.top + currentRect.height / 2
      let bestIndex = -1
      let bestScore = Number.POSITIVE_INFINITY

      cardRefs.current.forEach((card, index) => {
        if (!card || index === currentIndex) {
          return
        }
        const rect = card.getBoundingClientRect()
        const deltaX = rect.left + rect.width / 2 - originX
        const deltaY = rect.top + rect.height / 2 - originY
        if (direction === 'left' && deltaX >= -8) return
        if (direction === 'right' && deltaX <= 8) return
        if (direction === 'up' && deltaY >= -8) return
        if (direction === 'down' && deltaY <= 8) return
        const primary = direction === 'left' || direction === 'right'
          ? Math.abs(deltaX)
          : Math.abs(deltaY)
        const secondary = direction === 'left' || direction === 'right'
          ? Math.abs(deltaY)
          : Math.abs(deltaX)
        const score = primary + secondary * 2.4
        if (score < bestScore) {
          bestScore = score
          bestIndex = index
        }
      })

      if (bestIndex < 0) {
        if (direction === 'down') {
          try {
            window.LantaTV?.focusWelcomePlay?.()
          } catch {
            // Bridge exists only inside the Android TV shell.
          }
          return 'edge-bottom'
        }
        return direction === 'up' ? 'edge-top' : 'edge'
      }

      onSelectedIndexChangeRef.current(bestIndex)
      cardRefs.current[bestIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
      return 'ok'
    }

    window.__lantaTvMoveGallery = (direction: string) => {
      if (!isGalleryDirection(direction)) {
        return 'none'
      }
      return moveSelection(direction)
    }
    window.__lantaTvFocusGallery = () => {
      const card = cardRefs.current[selectedRef.current]
      card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return 'ok'
    }

    try {
      window.LantaTV?.enterGalleryNav?.()
    } catch {
      // Browser preview has no native shell.
    }
    const retry = window.setTimeout(() => {
      try {
        window.LantaTV?.enterGalleryNav?.()
      } catch {
        // Ignore.
      }
    }, 700)

    return () => {
      window.clearTimeout(retry)
      delete window.__lantaTvMoveGallery
      delete window.__lantaTvFocusGallery
    }
  }, [tvMode, videos.length])

  return (
    <section aria-label="Recommended for you" className="w-full">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-lanta-charcoal sm:text-xl">
          Recommended for you
        </h2>
        <p className="text-xs tracking-wide text-lanta-charcoal/50">
          {videos.length} video{videos.length === 1 ? '' : 's'}
        </p>
      </div>
      <ul
        className={cn(
          'tv-video-gallery grid grid-cols-2 gap-x-3 gap-y-5',
          'sm:grid-cols-3 lg:grid-cols-4',
        )}
      >
        {videos.map((video, index) => {
          const fileName = video.fileName ?? video.title
          const title = galleryDisplayTitle(video.title || fileName)
          const badge = getGalleryBadge(fileName, title)
          const durationLabel = formatGalleryDuration(durations[video.id] ?? 0)
          const selected = index === selectedIndex

          return (
            <li key={video.id}>
              <button
                type="button"
                ref={(node) => {
                  cardRefs.current[index] = node
                }}
                data-gallery-card="true"
                data-tv-autofocus={selected ? 'true' : undefined}
                tabIndex={0}
                onClick={() => onActivate(index)}
                onFocus={() => onSelectedIndexChange(index)}
                className={cn(
                  'tv-gallery-card block w-full rounded-md text-left',
                  'focus:outline-none focus-visible:outline-none',
                  selected && tvMode ? 'is-selected' : null,
                )}
                aria-label={`Play ${title}`}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="tv-gallery-thumb relative block">
                  <VideoPreviewThumb
                    src={video.src}
                    enabled={index < armedCount}
                    onDuration={(seconds) => {
                      setDurations((current) => (
                        current[video.id] === seconds
                          ? current
                          : { ...current, [video.id]: seconds }
                      ))
                    }}
                  />
                  {badge ? (
                    <span
                      className={cn(
                        'absolute top-2 right-2 z-10 inline-flex items-center gap-1.5',
                        'rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold',
                        'tracking-[0.12em] text-lanta-charcoal shadow-sm',
                      )}
                    >
                      <span
                        className={cn('h-2 w-2 rounded-full', TONE_CLASS[badge.tone])}
                        aria-hidden="true"
                      />
                      {badge.label}
                    </span>
                  ) : null}
                  {durationLabel ? (
                    <span
                      className={cn(
                        'absolute right-2 bottom-2 z-10 rounded-sm bg-black/80',
                        'px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums',
                      )}
                    >
                      {durationLabel}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'mt-2 block line-clamp-2 text-sm leading-snug',
                    'font-medium text-lanta-charcoal',
                  )}
                >
                  {title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
