import { cn } from '@/lib/utils'

type VideoLetterboxBrandProps = {
  className?: string
}

/**
 * Branded side rails that replace black pillarbox bars with vertical LANTA PILATES marks.
 * Sits behind the video (object-fit cover/contain) so any leftover sides stay on-theme.
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
    <LetterboxRail side="left" />
    <LetterboxRail side="right" />
  </div>
)

type LetterboxRailProps = {
  side: 'left' | 'right'
}

/**
 * One vertical brand rail for the left or right pillarbox area.
 *
 * @param side - Which edge to pin the rail to
 */
const LetterboxRail = ({ side }: LetterboxRailProps) => (
  <div
    className={cn(
      'absolute inset-y-0 flex w-[12%] max-w-[7.5rem] min-w-[2.75rem] items-center justify-center',
      'bg-gradient-to-b from-[#2c2824] via-[#1f1c19] to-[#2c2824]',
      side === 'left'
        ? 'left-0 border-r border-lanta-taupe/25'
        : 'right-0 border-l border-lanta-taupe/25',
    )}
  >
    <span
      className={cn(
        'font-display text-[clamp(0.75rem,1.7vw,1.25rem)] font-medium tracking-[0.38em]',
        'whitespace-nowrap text-lanta-sand/65 uppercase',
        '[writing-mode:vertical-rl]',
        side === 'left' ? 'rotate-180' : null,
      )}
    >
      Lanta Pilates
    </span>
  </div>
)
