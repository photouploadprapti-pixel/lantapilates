import { titleFromFileName } from '@/lib/local-video-catalog'
import {
  loadOfflineAppSettings,
  saveOfflineAppSettings,
} from '@/lib/offline-app-settings'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

/**
 * Merges newly discovered folder files into the saved playlist order.
 * Keeps the user's order; appends brand-new files at the end.
 *
 * @param existingOrder - Saved file-name order
 * @param discoveredNames - Names currently in the folder
 */
export const mergeOfflinePlaylistOrder = (
  existingOrder: string[],
  discoveredNames: string[],
): string[] => {
  const discovered = new Set(discoveredNames)
  const kept = existingOrder.filter((name) => discovered.has(name))
  const keptSet = new Set(kept)
  const added = discoveredNames.filter((name) => !keptSet.has(name))
  return [...kept, ...added]
}

/**
 * Returns the display title for a local file, preferring a saved rename.
 *
 * @param fileName - On-disk file name
 * @param titles - Optional title map from offline settings
 */
export const offlineDisplayTitle = (
  fileName: string,
  titles?: Record<string, string>,
): string => {
  const saved = titles?.[fileName]?.trim()
  if (saved) {
    return saved
  }
  return titleFromFileName(fileName)
}

/**
 * Builds an ordered offline playlist from folder files + saved settings.
 *
 * @param files - Files from the LocalVideos scan
 */
export const buildOfflinePlaylist = (
  files: LocalVideoFile[],
): LocalPlaylistVideo[] => {
  const settings = loadOfflineAppSettings()
  const playable = files.filter((file) => Boolean(file.playbackUrl))
  const byName = new Map(playable.map((file) => [file.name, file]))
  const order = mergeOfflinePlaylistOrder(
    settings.selectedFileNames,
    playable.map((file) => file.name),
  )

  return order.flatMap((name) => {
    const file = byName.get(name)
    if (!file) {
      return []
    }
    return [{
      id: file.id,
      title: offlineDisplayTitle(file.name, settings.videoTitles),
      src: file.playbackUrl,
      fileName: file.name,
    }]
  })
}

/**
 * Persists a new playlist order (and optional titles) for offline playback.
 *
 * @param fileNames - Ordered file names
 * @param titles - Optional title map override
 */
export const saveOfflinePlaylistOrder = (
  fileNames: string[],
  titles?: Record<string, string>,
) => {
  const current = loadOfflineAppSettings()
  return saveOfflineAppSettings({
    selectedFileNames: fileNames,
    videoTitles: titles ?? current.videoTitles,
  })
}

/**
 * Moves one file earlier or later in the saved offline playlist.
 *
 * @param fileName - File to move
 * @param direction - -1 earlier, +1 later
 */
export const moveOfflinePlaylistItem = (
  fileName: string,
  direction: -1 | 1,
): string[] => {
  const settings = loadOfflineAppSettings()
  const order = [...settings.selectedFileNames]
  const index = order.indexOf(fileName)
  if (index < 0) {
    return order
  }
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= order.length) {
    return order
  }
  const [moved] = order.splice(index, 1)
  if (!moved) {
    return settings.selectedFileNames
  }
  order.splice(nextIndex, 0, moved)
  saveOfflinePlaylistOrder(order)
  return order
}
