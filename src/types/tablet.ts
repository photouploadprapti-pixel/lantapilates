export type TabletSlug = 'tab1' | 'tab2' | 'tab3' | 'tab4'

export const TABLET_SLUGS: TabletSlug[] = ['tab1', 'tab2', 'tab3', 'tab4']

export type TabletUser = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type Tablet = {
  slug: TabletSlug
  user_id: string | null
  updated_at: string
}

export type UserVideo = {
  id: string
  user_id: string
  youtube_video_id: string
  title: string | null
  sort_order: number
  created_at: string
}

export type TabletWithUser = Tablet & {
  user: TabletUser | null
}

export type TabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  videoIds: string[]
}

export type AdminUserPayload = {
  id?: string
  name: string
}

export type AdminAssignTabletPayload = {
  slug: TabletSlug
  userId: string | null
}

export type AdminAddVideoPayload = {
  userId: string
  url: string
}

export type AdminDeleteVideoPayload = {
  videoId: string
}

export type AdminReorderVideosPayload = {
  userId: string
  videoIds: string[]
}
