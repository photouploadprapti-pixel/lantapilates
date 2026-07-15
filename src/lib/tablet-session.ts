import { TABLET_SLUGS, type TabletSlug } from '@/types/tablet'

const TABLET_SESSION_KEY = 'lanta-tablet-session'

export type StoredTabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  videoFileNames: string[]
}

/**
 * Persists tablet session data for playback navigation.
 * @param session - Tablet session payload
 */
export const saveTabletSession = (session: StoredTabletSession): void => {
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.setItem(TABLET_SESSION_KEY, JSON.stringify(session))
}

/**
 * Loads tablet session data from session storage.
 */
export const loadTabletSession = (): StoredTabletSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = sessionStorage.getItem(TABLET_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredTabletSession
  } catch {
    return null
  }
}

/**
 * Clears tablet session data.
 */
export const clearTabletSession = (): void => {
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.removeItem(TABLET_SESSION_KEY)
}

/**
 * Builds the welcome route for a tablet slug.
 * @param slug - Tablet slug
 */
export const getTabletPath = (slug: TabletSlug): string => `/${slug}/`

/**
 * Builds the playback route for a tablet slug.
 * @param slug - Tablet slug
 */
export const getTabletPlayPath = (slug: TabletSlug): string => `/${slug}/play/`

/**
 * Returns true when the slug is one of the configured tablets.
 * @param slug - Route segment
 */
export const isKnownTabletSlug = (slug: string): slug is TabletSlug =>
  TABLET_SLUGS.includes(slug as TabletSlug)
