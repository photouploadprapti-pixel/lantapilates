import type { TabletSlug } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'

/** User-facing names for the four reformer stations (route slugs stay tab1–tab4). */
export const REFORMER_LABELS: Record<TabletSlug, string> = {
  tab1: 'Reformer 1',
  tab2: 'Reformer 2',
  tab3: 'Reformer 3',
  tab4: 'Reformer 4',
}

/**
 * Returns the display label for a reformer route slug.
 *
 * @param slug - Route slug tab1–tab4
 */
export const getReformerLabel = (slug: TabletSlug | string): string => {
  if (TABLET_SLUGS.includes(slug as TabletSlug)) {
    return REFORMER_LABELS[slug as TabletSlug]
  }
  return slug
}
