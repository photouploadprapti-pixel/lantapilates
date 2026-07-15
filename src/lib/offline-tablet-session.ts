import type { TabletSlug } from '@/types/tablet'

const OFFLINE_SESSION_PREFIX = 'lanta-tablet-offline:'

export type OfflineTabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  videoFileNames: string[]
  cachedAt: string
}

/**
 * Persists tablet assignment + video file names for offline playback.
 *
 * @param session - Tablet session snapshot
 */
export const saveOfflineTabletSession = (session: OfflineTabletSession): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    `${OFFLINE_SESSION_PREFIX}${session.slug}`,
    JSON.stringify(session),
  )
}

/**
 * Loads a cached offline tablet session.
 *
 * @param slug - Tablet route slug
 */
export const loadOfflineTabletSession = (slug: TabletSlug): OfflineTabletSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(`${OFFLINE_SESSION_PREFIX}${slug}`)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as OfflineTabletSession
  } catch {
    return null
  }
}
