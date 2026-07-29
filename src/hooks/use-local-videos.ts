'use client'

import { useCallback, useEffect, useState } from 'react'

import { isNativeApp } from '@/lib/is-native-app'
import { mapLocalFilesToWorkoutVideos } from '@/lib/local-video-catalog'
import {
  clearDirectoryHandle,
  loadFolderMeta,
  pickWebDirectory,
  restoreWebDirectoryVideos,
} from '@/lib/web-video-folder'
import { LocalVideos } from '@/plugins/local-videos'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'
import type { WorkoutVideo } from '@/types/workout-video'

type LocalVideosState = {
  isReady: boolean
  hasFolder: boolean
  folderName: string | null
  folderPath: string | null
  onRemovable: boolean
  files: LocalVideoFile[]
  videos: WorkoutVideo[]
  error: string | null
  isLoading: boolean
}

const INITIAL_STATE: LocalVideosState = {
  isReady: false,
  hasFolder: false,
  folderName: null,
  folderPath: null,
  onRemovable: false,
  files: [],
  videos: [],
  error: null,
  isLoading: true,
}

/**
 * Formats a library label that shows whether videos came from USB or internal storage.
 *
 * @param folderName - Folder name (usually LantaPilates)
 * @param folderPath - Absolute path when known
 * @param onRemovable - True for USB / SD
 */
const formatLibraryLabel = (
  folderName: string | null | undefined,
  folderPath: string | null | undefined,
  onRemovable: boolean | undefined,
): string => {
  const name = folderName?.trim() || 'LantaPilates'
  if (onRemovable) {
    return `${name} (USB / external)`
  }
  if (folderPath && /\/storage\/emulated\//i.test(folderPath)) {
    return `${name} (internal)`
  }
  return name
}

/**
 * Loads offline videos from the fixed LantaPilates folder (internal storage or USB).
 */
export const useLocalVideos = () => {
  const [state, setState] = useState<LocalVideosState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      if (isNativeApp()) {
        const folderStatus = await LocalVideos.hasFolder()

        if (!folderStatus.hasFolder) {
          setState({
            isReady: true,
            hasFolder: false,
            folderName: null,
            folderPath: null,
            onRemovable: false,
            files: [],
            videos: [],
            error: null,
            isLoading: false,
          })
          return
        }

        const listed = await LocalVideos.listVideos()
        const files = listed.videos
        const folderPath = listed.folderPath ?? folderStatus.folderPath ?? null
        const onRemovable = Boolean(listed.onRemovable ?? folderStatus.onRemovable)
        const folderName = formatLibraryLabel(
          listed.folderName ?? folderStatus.folderName,
          folderPath,
          onRemovable,
        )

        setState({
          isReady: true,
          hasFolder: true,
          folderName,
          folderPath,
          onRemovable,
          files,
          videos: mapLocalFilesToWorkoutVideos(files),
          error: null,
          isLoading: false,
        })
        return
      }

      const restored = await restoreWebDirectoryVideos()
      if (!restored) {
        setState({
          isReady: true,
          hasFolder: Boolean(loadFolderMeta()),
          folderName: loadFolderMeta()?.folderName ?? null,
          folderPath: null,
          onRemovable: false,
          files: [],
          videos: [],
          error: null,
          isLoading: false,
        })
        return
      }

      const playable = restored.videos.filter((file) => Boolean(file.playbackUrl))
      setState({
        isReady: true,
        hasFolder: true,
        folderName: restored.folderName,
        folderPath: null,
        onRemovable: false,
        files: restored.videos,
        videos: mapLocalFilesToWorkoutVideos(playable),
        error: null,
        isLoading: false,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load local videos.'
      setState({
        isReady: true,
        hasFolder: false,
        folderName: null,
        folderPath: null,
        onRemovable: false,
        files: [],
        videos: [],
        error: message,
        isLoading: false,
      })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Native shell fires this after USB plug / returning from All-files settings.
  useEffect(() => {
    const onRefresh = () => {
      void refresh()
    }
    window.addEventListener('lanta-library-refresh', onRefresh)
    return () => window.removeEventListener('lanta-library-refresh', onRefresh)
  }, [refresh])

  const pickFolder = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      if (isNativeApp()) {
        const result = await LocalVideos.pickFolder()
        if (result.videos && result.videos.length > 0) {
          const folderPath = result.folderPath ?? null
          const onRemovable = Boolean(result.onRemovable)
          setState({
            isReady: true,
            hasFolder: true,
            folderName: formatLibraryLabel(result.folderName, folderPath, onRemovable),
            folderPath,
            onRemovable,
            files: result.videos,
            videos: mapLocalFilesToWorkoutVideos(result.videos),
            error: null,
            isLoading: false,
          })
          return
        }

        await refresh()
        if (result.videoCount === 0) {
          setState((prev) => ({
            ...prev,
            hasFolder: true,
            folderName: formatLibraryLabel(
              result.folderName,
              result.folderPath,
              result.onRemovable,
            ),
            folderPath: result.folderPath ?? prev.folderPath,
            onRemovable: Boolean(result.onRemovable),
            files: [],
            videos: [],
            error:
              'No supported videos found in LantaPilates. Put .mp4 or .ts files in that folder on Internal storage or USB, allow All files access if prompted, then Refresh.',
            isLoading: false,
          }))
        }
        return
      }

      const result = await pickWebDirectory()
      setState({
        isReady: true,
        hasFolder: true,
        folderName: result.folderName,
        folderPath: null,
        onRemovable: false,
        files: result.videos,
        videos: mapLocalFilesToWorkoutVideos(result.videos),
        error: null,
        isLoading: false,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not select a folder.'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }))
    }
  }, [refresh])

  const changeFolder = useCallback(async () => {
    await pickFolder()
  }, [pickFolder])

  const clearFolder = useCallback(async () => {
    if (isNativeApp()) {
      await LocalVideos.clearFolder()
    } else {
      await clearDirectoryHandle()
    }
    await refresh()
  }, [refresh])

  return {
    ...state,
    pickFolder,
    changeFolder,
    clearFolder,
    refresh,
  }
}
