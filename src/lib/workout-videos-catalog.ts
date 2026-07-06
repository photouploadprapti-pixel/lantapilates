import type { WorkoutVideo } from '@/types/workout-video'

/** Shared Google Drive folder for workout videos */
export const WORKOUT_VIDEOS_FOLDER_ID = '1ciT_sSgcFQIIXyKCwIFQq2pr80TjodpH'

import { LANTA_REFORMER_PLAYLIST_ID } from '@/lib/youtube-playlist'

/**
 * Default workout played from the welcome screen.
 */
export const DEFAULT_WORKOUT_VIDEO: WorkoutVideo = {
  id: 'reformer-playlist',
  title: 'Reformer Workouts',
  description: 'Full reformer Pilates playlist',
  durationLabel: 'Playlist',
  targetAreas: ['shoulders', 'arms', 'chest', 'back', 'abs', 'legs', 'thighs'],
  source: {
    type: 'youtube',
    playlistId: LANTA_REFORMER_PLAYLIST_ID,
  },
}

/**
 * Master catalog of available workout videos.
 * Filtering by body-area selection will use `targetAreas` in a later iteration.
 */
export const WORKOUT_VIDEO_CATALOG: readonly WorkoutVideo[] = [
  DEFAULT_WORKOUT_VIDEO,
  {
    id: 'upper-body-reformer-32',
    title: 'Upper Body Reformer Pilates Workout',
    description: '32-minute upper-body reformer session',
    durationLabel: '32 min',
    targetAreas: ['shoulders', 'arms', 'chest', 'back'],
    source: {
      type: 'google-drive',
      fileId: '1AosqrAcrushQ1dNmT8LI42FuRB0ojWSa',
      folderId: WORKOUT_VIDEOS_FOLDER_ID,
    },
  },
  {
    id: 'what-is-reformer',
    title: 'What is a Pilates Reformer Machine?',
    description: 'Introduction to the reformer machine',
    durationLabel: 'Short',
    targetAreas: [],
    source: {
      type: 'google-drive',
      fileId: '1aV_fwH6A2Qx0XJ_-4IKQuFnKVa0lnN8r',
      folderId: WORKOUT_VIDEOS_FOLDER_ID,
    },
  },
] as const
