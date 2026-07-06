import type { LocalVideoFile } from '@/plugins/local-videos/definitions'
import type { WorkoutVideo } from '@/types/workout-video'

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mkv',
  '.mov',
  '.avi',
  '.3gp',
])

/**
 * Derives a readable title from a video file name.
 *
 * @param fileName - Raw file name including extension
 */
export const titleFromFileName = (fileName: string): string => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  return withoutExtension
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Maps native folder scan results into workout video entries for the UI.
 *
 * @param files - Videos returned from the LocalVideos plugin
 */
export const mapLocalFilesToWorkoutVideos = (
  files: LocalVideoFile[],
): WorkoutVideo[] =>
  files.map((file) => ({
    id: file.id,
    title: titleFromFileName(file.name),
    description: file.name,
    targetAreas: [],
    source: {
      type: 'local',
      localPath: file.playbackUrl,
      fileName: file.name,
    },
  }))

/**
 * Filters a file name list to common video extensions (web fallback picker).
 *
 * @param fileName - File name to test
 */
export const isVideoFileName = (fileName: string): boolean => {
  const lower = fileName.toLowerCase()
  return [...VIDEO_EXTENSIONS].some((ext) => lower.endsWith(ext))
}
