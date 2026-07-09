import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

/**
 * Primary action button for tablet-first layouts.
 */
export const Button = ({
  className,
  children,
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'inline-flex min-h-[3.5rem] w-full items-center justify-center',
      'rounded-sm px-6 text-base font-medium tracking-[0.12em] uppercase',
      'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      variant === 'primary'
        && 'bg-lanta-taupe text-white hover:bg-lanta-taupe/90 active:bg-lanta-taupe/80',
      variant === 'secondary'
        && 'border border-lanta-taupe bg-transparent text-lanta-taupe hover:bg-lanta-cream',
      variant === 'ghost'
        && 'w-auto min-h-0 rounded-md bg-transparent px-4 py-2 normal-case tracking-normal text-lanta-charcoal hover:bg-lanta-sand/60',
      className,
    )}
    {...props}
  >
    {children}
  </button>
)
