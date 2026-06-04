import type { LabelHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode
}

/**
 * Accessible form label styled for tablet touch layouts.
 */
export const Label = ({ className, children, ...props }: LabelProps) => (
  <label
    className={cn(
      'block text-sm font-medium tracking-wide text-lanta-charcoal/80 uppercase',
      className,
    )}
    {...props}
  >
    {children}
  </label>
)
