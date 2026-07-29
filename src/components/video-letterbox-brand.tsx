import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type VideoLetterboxBrandProps = {
  className?: string
}

/**
 * Full-bleed branded stage behind a contained video (gradient only).
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
    <div className="absolute inset-y-0 left-0 flex w-[min(18vw,9rem)] items-center justify-center">
      <LetterboxMark side="left" />
    </div>
    <div className="absolute inset-y-0 right-0 flex w-[min(18vw,9rem)] items-center justify-center">
      <LetterboxMark side="right" />
    </div>
  </div>
)

type VideoLetterboxStageProps = {
  children: ReactNode
  className?: string
}

/**
 * Responsive player stage: left brand rail · video · right brand rail.
 * Rails share leftover width so vertical text stays centered and never under the video.
 *
 * @param children - Video (or iframe) element
 * @param className - Optional stage classes
 */
export const VideoLetterboxStage = ({ children, className }: VideoLetterboxStageProps) => (
  <div
    className={cn(
      'absolute inset-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch',
      'bg-[radial-gradient(ellipse_at_center,_#2a2622_0%,_#1a1a1a_55%,_#141210_100%)]',
      className,
    )}
  >
    <LetterboxRail side="left" />
    <div className="relative z-[1] flex h-full max-w-full min-w-0 items-center justify-center">
      {children}
    </div>
    <LetterboxRail side="right" />
  </div>
)

type LetterboxRailProps = {
  side: 'left' | 'right'
}

/**
 * One flexible side rail that grows with leftover screen width.
 *
 * @param side - Which edge the rail represents
 */
export const LetterboxRail = ({ side }: LetterboxRailProps) => (
  <div
    className={cn(
      'pointer-events-none relative z-0 flex h-full min-w-0 items-center justify-center',
      'overflow-hidden [container-type:size]',
      side === 'left'
        ? 'border-r border-lanta-taupe/20'
        : 'border-l border-lanta-taupe/20',
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
 * Large vertical LANTA PILATES mark sized to the rail via container queries.
 *
 * @param side - Controls text rotation so both sides read upward
 */
const LetterboxMark = ({ side }: LetterboxMarkProps) => (
  <span
    className={cn(
      'font-display font-semibold uppercase',
      'text-lanta-sand/70',
      'whitespace-nowrap select-none',
      '[writing-mode:vertical-rl]',
      'text-[clamp(1.1rem,min(58cqw,9cqh),3.75rem)]',
      'tracking-[0.22em]',
      'leading-none',
      side === 'left' ? 'rotate-180' : null,
    )}
  >
    Lanta Pilates
  </span>
)
