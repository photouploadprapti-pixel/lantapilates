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
  files: LocalVideoFile[]
  videos: WorkoutVideo[]
  error: string | null
  isLoading: boolean
}

const INITIAL_STATE: LocalVideosState = {
  isReady: false,
  hasFolder: false,
  folderName: null,
  files: [],
  videos: [],
  error: null,
  isLoading: true,
}

/**
 * Loads offline videos from the user-selected folder (native Android or web).
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
            files: [],
            videos: [],
            error: null,
            isLoading: false,
          })
          return
        }

        const { videos: files } = await LocalVideos.listVideos()
        setState({
          isReady: true,
          hasFolder: true,
          folderName: folderStatus.folderName ?? 'Selected folder',
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

  const pickFolder = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      if (isNativeApp()) {
        await LocalVideos.pickFolder()
        await refresh()
        return
      }

      const result = await pickWebDirectory()
      setState({
        isReady: true,
        hasFolder: true,
        folderName: result.folderName,
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
