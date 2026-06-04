import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AppShellProps = {
  children: ReactNode
  title?: string
  subtitle?: string
  className?: string
  mainClassName?: string
}

/**
 * Branded page shell aligned with lantapilates.com layout and typography.
 */
export const AppShell = ({
  children,
  title,
  subtitle,
  className,
  mainClassName,
}: AppShellProps) => (
  <div
    className={cn(
      'flex min-h-dvh flex-col bg-lanta-cream text-lanta-charcoal',
      'px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]',
      'pt-[max(2rem,env(safe-area-inset-top))]',
      className,
    )}
  >
    <header className="mx-auto w-full max-w-xl text-center">
      <p className="font-display text-xs tracking-[0.35em] text-lanta-sage uppercase">
        Lanta Pilates
      </p>
      <h1 className="font-display mt-3 text-4xl font-light tracking-[0.08em] uppercase md:text-5xl">
        {title ?? 'Lanta Moves'}
      </h1>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-lanta-charcoal/70">
          {subtitle}
        </p>
      ) : null}
    </header>
    <main
      className={cn('mx-auto mt-10 w-full max-w-xl flex-1', mainClassName)}
    >
      {children}
    </main>
  </div>
)
