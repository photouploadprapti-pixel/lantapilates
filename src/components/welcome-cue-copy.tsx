import { cn } from '@/lib/utils'

type WelcomeCueCopyProps = {
  className?: string
}

/**
 * Pyramid-centered movement cue shown above Play on welcome screens.
 *
 * @param className - Optional layout/spacing overrides
 */
export const WelcomeCueCopy = ({ className }: WelcomeCueCopyProps) => (
  <div
    className={cn(
      'flex flex-col items-center text-center text-base leading-snug',
      'text-lanta-charcoal/75 sm:text-lg',
      className,
    )}
  >
    <p>Breathe wide</p>
    <p>Lengthen your spine</p>
    <p>Engage your deep core</p>
  </div>
)
