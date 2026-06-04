import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type BodyAreasSectionProps = {
  title: string
  hint: string
  accentClass: string
  children: ReactNode
}

/**
 * Labeled section wrapper for need or avoid body area grids.
 */
export const BodyAreasSection = ({
  title,
  hint,
  accentClass,
  children,
}: BodyAreasSectionProps) => (
  <section className="space-y-4">
    <div>
      <h2
        className={cn(
          'font-display text-2xl font-light tracking-[0.06em] uppercase',
          accentClass,
        )}
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-lanta-charcoal/60">{hint}</p>
    </div>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{children}</div>
  </section>
)
