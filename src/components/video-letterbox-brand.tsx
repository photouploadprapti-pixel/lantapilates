import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type VideoLetterboxBrandProps = {
  className?: string
}

/**
 * Full-bleed branded stage behind a contained video (gradient + side marks).
 * Prefer {@link VideoLetterboxStage} when side rails should stay beside the video.
 *
 * @param className - Optional wrapper classes
 */
export const VideoLetterboxBrand = ({ className }: VideoLetterboxBrandProps) => (
  <div
    className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}
    aria-hidden="true"
  >
    <div
      className={cn(
        'absolute inset-0',
        'bg-[radial-gradient(ellipse_at_center,_#2a2622_0%,_#1a1a1a_55%,_#141210_100%)]',
      )}
    />
    <div className="absolute inset-y-0 left-0 flex w-[min(14vw,7.5rem)] min-w-[3.25rem] items-center justify-center">
      <LetterboxMark side="left" />
    </div>
    <div className="absolute inset-y-0 right-0 flex w-[min(14vw,7.5rem)] min-w-[3.25rem] items-center justify-center">
      <LetterboxMark side="right" />
    </div>
  </div>
)

type VideoLetterboxStageProps = {
  children: ReactNode
  className?: string
}

/**
 * Player stage: left brand rail · video · right brand rail.
 * Rails keep a minimum width so branding stays visible on wide / near-full-bleed video.
 * Uses relative sizing (not absolute fill) so flex layouts can reserve the bottom control bar.
 *
 * @param children - Video (or iframe) element
 * @param className - Optional stage classes
 */
export const VideoLetterboxStage = ({ children, className }: VideoLetterboxStageProps) => (
  <div
    className={cn(
      'relative grid h-full min-h-0 w-full grid-cols-[minmax(3.25rem,14vw)_minmax(0,1fr)_minmax(3.25rem,14vw)]',
      'items-stretch',
      'bg-[radial-gradient(ellipse_at_center,_#2a2622_0%,_#1a1a1a_55%,_#141210_100%)]',
      className,
    )}
  >
    <LetterboxRail side="left" />
    <div className="relative z-[1] flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
      {children}
    </div>
    <LetterboxRail side="right" />
  </div>
)

type LetterboxRailProps = {
  side: 'left' | 'right'
}

/**
 * One side rail that always reserves space for the vertical brand mark.
 *
 * @param side - Which edge the rail represents
 */
export const LetterboxRail = ({ side }: LetterboxRailProps) => (
  <div
    className={cn(
      'pointer-events-none relative z-0 flex h-full min-h-0 w-full items-center justify-center',
      'overflow-hidden',
      side === 'left'
        ? 'border-r border-lanta-taupe/25'
        : 'border-l border-lanta-taupe/25',
    )}
    aria-hidden="true"
  >
    <LetterboxMark side={side} />
  </div>
)

type LetterboxMarkProps = {
  side: 'left' | 'right'
}

/**
 * Large vertical LANTA PILATES mark.
 * Sized with vw/vh (not container queries) so Android WebViews always show it.
 *
 * @param side - Controls text rotation so both sides read upward
 */
const LetterboxMark = ({ side }: LetterboxMarkProps) => (
  <span
    className={cn(
      'font-display font-semibold uppercase',
      'text-lanta-sand/80',
      'whitespace-nowrap select-none',
      '[writing-mode:vertical-rl]',
      'text-[clamp(1.15rem,2.8vw,2.85rem)]',
      'tracking-[0.2em]',
      'leading-none',
      side === 'left' ? 'rotate-180' : null,
    )}
  >
    Lanta Pilates
  </span>
)
