import { isLegacyDriveVideoId } from '@/lib/hosted-videos'
import { isVideoFileName } from '@/lib/local-video-catalog'
import { TABLET_SLUGS, type TabletSlug, type TabletVideoSource } from '@/types/tablet'

const TABLET_SESSION_KEY = 'lanta-tablet-session'

export type StoredTabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  videoFileNames: string[]
  videoTitles?: string[]
  videoSource?: TabletVideoSource
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
 * Preserves offline `local` source and local file names (.mp4 / .ts / etc.).
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
    const parsed = JSON.parse(raw) as StoredTabletSession
    const videoSource: TabletVideoSource =
      parsed.videoSource === 'local' ? 'local' : 'hosted'

    const rawNames = parsed.videoFileNames ?? []
    const videoFileNames =
      videoSource === 'local'
        ? rawNames.filter((name) => isVideoFileName(name) || name.trim().length > 0)
        : rawNames.filter((name) => !isLegacyDriveVideoId(name))

    const rawTitles = parsed.videoTitles ?? parsed.videoFileNames ?? []
    const videoTitles = videoFileNames.map((name, index) => {
      const originalIndex = rawNames.indexOf(name)
      if (originalIndex >= 0 && rawTitles[originalIndex]) {
        return rawTitles[originalIndex]
      }
      return rawTitles[index] ?? name
    })

    return {
      ...parsed,
      videoFileNames,
      videoTitles,
      videoSource,
    }
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
