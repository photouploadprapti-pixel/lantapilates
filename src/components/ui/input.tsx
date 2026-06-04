import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement>

/**
 * Large touch-friendly text input matching Lanta brand styling.
 */
export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={cn(
      'w-full rounded-sm border border-lanta-sand bg-white px-4 py-4',
      'text-lg text-lanta-charcoal placeholder:text-lanta-charcoal/40',
      'outline-none transition-colors focus:border-lanta-taupe focus:ring-2',
      'focus:ring-lanta-taupe/25 min-h-[3.25rem]',
      className,
    )}
    {...props}
  />
)
