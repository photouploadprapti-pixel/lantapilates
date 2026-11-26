import { cn } from '@/lib/utils'

type WelcomeCueCopyProps = {
  className?: string
}

/**
 * Short movement cue shown above Play on welcome screens.
 *
 * @param className - Optional layout/spacing overrides
 */
export const WelcomeCueCopy = ({ className }: WelcomeCueCopyProps) => (
  <div className={cn('text-center text-lanta-charcoal/75', className)}>
    <p className="text-base leading-snug sm:text-lg">
      Breathe wide · Lengthen your spine ·
      <br />
      Engage your deep core
    </p>
    <p className="mt-2 text-sm italic leading-snug text-lanta-charcoal/60 sm:text-base">
      Move with control, not momentum.
    </p>
  </div>
)
