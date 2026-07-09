import { getSupabaseClient } from '@/lib/supabase-client'
import type { TabletSession, TabletSlug, TabletUser, TabletWithUser, UserVideo } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'

/**
 * Validates a tablet slug from the URL.
 * @param slug - Route segment (e.g. tab1)
 */
export const isTabletSlug = (slug: string): slug is TabletSlug =>
  TABLET_SLUGS.includes(slug as TabletSlug)

/**
 * Loads tablet assignment, user profile, and assigned video ids for kiosk playback.
 * @param slug - Tablet route slug
 */
export const fetchTabletSession = async (slug: TabletSlug): Promise<TabletSession | null> => {
  const supabase = getSupabaseClient()
  const { data: tablet, error: tabletError } = await supabase
    .from('tablets')
    .select('slug, user_id, updated_at, user:tablet_users(id, name, created_at, updated_at)')
    .eq('slug', slug)
    .maybeSingle()

  if (tabletError || !tablet?.user_id) {
    return null
  }

  const nestedUser = tablet.user
  const user = (Array.isArray(nestedUser) ? nestedUser[0] : nestedUser) as TabletUser | null | undefined
  if (!user) {
    return null
  }

  const { data: videos, error: videosError } = await supabase
    .from('user_videos')
    .select('youtube_video_id')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (videosError) {
    return null
  }

  return {
    slug,
    userId: user.id,
    userName: user.name,
    videoIds: (videos ?? []).map((video) => video.youtube_video_id),
  }
}

/**
 * Loads all users for admin display.
 */
export const fetchAllTabletUsers = async (): Promise<TabletUser[]> => {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tablet_users')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

/**
 * Loads tablet assignments with nested user records.
 */
export const fetchAllTablets = async (): Promise<TabletWithUser[]> => {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tablets')
    .select('slug, user_id, updated_at, user:tablet_users(id, name, created_at, updated_at)')
    .order('slug', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const nestedUser = row.user
    const user = (Array.isArray(nestedUser) ? nestedUser[0] : nestedUser) as TabletUser | null | undefined

    return {
      slug: row.slug,
      user_id: row.user_id,
      updated_at: row.updated_at,
      user: user ?? null,
    }
  })
}

/**
 * Loads videos assigned to a user.
 * @param userId - Tablet user id
 */
export const fetchUserVideos = async (userId: string): Promise<UserVideo[]> => {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('user_videos')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
