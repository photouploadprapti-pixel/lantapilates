'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type VideoPreviewThumbProps = {
  src: string
  /** When false, skip the network request (gallery staggers previews). */
  enabled: boolean
  onDuration?: (seconds: number) => void
  className?: string
}

/**
 * Still frame from a hosted video, used as the gallery thumbnail.
 * Seeks a little past the start so the card is not a black first frame.
 *
 * @param src - Playable video URL
 * @param enabled - Load metadata only when this card is allowed to fetch
 * @param onDuration - Called once the clip length is known
 * @param className - Optional classes for the frame
 */
export const VideoPreviewThumb = ({
  src,
  enabled,
  onDuration,
  className,
}: VideoPreviewThumbProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDurationRef = useRef(onDuration)
  const [failed, setFailed] = useState(false)
  const [poster, setPoster] = useState<string | null>(null)
  onDurationRef.current = onDuration

  useEffect(() => {
    const element = videoRef.current
    if (!element || !enabled || !src) {
      return
    }

    let cancelled = false
    let captured = false
    let seekAttempt = 0
    setFailed(false)
    setPoster(null)

    /**
     * Copies the current frame into a still image and releases the decoder.
     */
    const captureFrame = (): boolean => {
      if (element.videoWidth < 2 || element.videoHeight < 2) {
        return false
      }
      const canvas = document.createElement('canvas')
      const width = 480
      const height = Math.max(1, Math.round(width * (element.videoHeight / element.videoWidth)))
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        return false
      }
      try {
        context.drawImage(element, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data
        let total = 0
        let samples = 0
        for (let index = 0; index < pixels.length; index += 64) {
          total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3
          samples += 1
        }
        const average = samples > 0 ? total / samples : 0
        // Opening slates are near-white. Try a later frame before keeping one.
        if (average > 225 && seekAttempt < 1) {
          return false
        }
        const url = canvas.toDataURL('image/jpeg', 0.72)
        if (!cancelled) {
          setPoster(url)
        }
        captured = true
        element.pause()
        element.removeAttribute('src')
        element.load()
        return true
      } catch {
        return false
      }
    }

    /**
     * Seeks past a black opening frame. Tries a later point if the first seek is empty.
     */
    const seekPreview = () => {
      const duration = element.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        return
      }
      const points = [
        Math.min(12, Math.max(0.4, duration - 0.4)),
        Math.min(28, Math.max(0.4, duration - 0.4)),
      ]
      const target = points[Math.min(seekAttempt, points.length - 1)] ?? 1
      try {
        element.currentTime = Math.max(0.2, target)
      } catch {
        // Seek can throw before the first media buffer arrives.
      }
    }

    /**
     * Reports duration and seeks to a visible frame.
     */
    const handleMetadata = () => {
      if (cancelled) {
        return
      }
      const duration = element.duration
      if (Number.isFinite(duration) && duration > 0) {
        onDurationRef.current?.(duration)
      }
      seekPreview()
    }

    /**
     * Stores the frame after the seek completes.
     */
    const handleSeeked = () => {
      if (cancelled) {
        return
      }
      if (captureFrame()) {
        return
      }
      if (seekAttempt < 1) {
        seekAttempt += 1
        seekPreview()
      }
    }

    /**
     * Shows the placeholder when the preview cannot load.
     */
    const handleError = () => {
      if (!cancelled && !captured) {
        setFailed(true)
      }
    }

    element.addEventListener('loadedmetadata', handleMetadata)
    element.addEventListener('seeked', handleSeeked)
    element.addEventListener('error', handleError)
    element.preload = 'metadata'
    element.src = src

    return () => {
      cancelled = true
      element.removeEventListener('loadedmetadata', handleMetadata)
      element.removeEventListener('seeked', handleSeeked)
      element.removeEventListener('error', handleError)
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [enabled, src])

  return (
    <span
      className={cn(
        'relative block aspect-video w-full overflow-hidden rounded-md bg-[#d7d0c8]',
        className,
      )}
    >
      {poster ? (
        <img src={poster} alt="" className="h-full w-full object-cover" />
      ) : null}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="none"
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          'pointer-events-none h-full w-full border-0 object-cover',
          poster || failed ? 'hidden' : null,
        )}
      />
      {failed ? (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center text-[10px]',
            'tracking-[0.14em] text-lanta-charcoal/45 uppercase',
          )}
        >
          Preview
        </span>
      ) : null}
    </span>
  )
}
