import type { WorkoutVideo } from '@/types/workout-video'

/** Shared Google Drive folder for workout videos */
export const WORKOUT_VIDEOS_FOLDER_ID = '1ciT_sSgcFQIIXyKCwIFQq2pr80TjodpH'

/**
 * Master catalog of available workout videos.
 * Filtering by body-area selection will use `targetAreas` in a later iteration.
 */
export const WORKOUT_VIDEO_CATALOG: readonly WorkoutVideo[] = [
  {
    id: 'full-body-reformer-30',
    title: 'Full Body Reformer Pilates Workout',
    description: '30-minute full-body reformer session',
    durationLabel: '30 min',
    targetAreas: ['shoulders', 'arms', 'chest', 'back', 'abs', 'legs', 'thighs'],
    source: {
      type: 'google-drive',
      fileId: '1j_UP9Ld3JK9l_hJgbup8lYT_Gqc-fLss',
      folderId: WORKOUT_VIDEOS_FOLDER_ID,
    },
  },
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
