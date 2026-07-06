'use client'

import { useCallback, useEffect, useState } from 'react'

import { isNativeApp } from '@/lib/is-native-app'
import { mapLocalFilesToWorkoutVideos } from '@/lib/local-video-catalog'
import { LocalVideos } from '@/plugins/local-videos'
import type { WorkoutVideo } from '@/types/workout-video'

type LocalVideosState = {
  isNative: boolean
  isReady: boolean
  hasFolder: boolean
  folderName: string | null
  videos: WorkoutVideo[]
  error: string | null
  isLoading: boolean
}

const INITIAL_STATE: LocalVideosState = {
  isNative: false,
  isReady: false,
  hasFolder: false,
  folderName: null,
  videos: [],
  error: null,
  isLoading: true,
}

/**
 * Loads offline videos from the user-selected folder on native Android.
 */
export const useLocalVideos = () => {
  const [state, setState] = useState<LocalVideosState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    if (!isNativeApp()) {
      setState({
        isNative: false,
        isReady: true,
        hasFolder: false,
        folderName: null,
        videos: [],
        error: null,
        isLoading: false,
      })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const folderStatus = await LocalVideos.hasFolder()

      if (!folderStatus.hasFolder) {
        setState({
          isNative: true,
          isReady: true,
          hasFolder: false,
          folderName: null,
          videos: [],
          error: null,
          isLoading: false,
        })
        return
      }

      const { videos: files } = await LocalVideos.listVideos()
      const videos = mapLocalFilesToWorkoutVideos(files)

      setState({
        isNative: true,
        isReady: true,
        hasFolder: true,
        folderName: folderStatus.folderName ?? 'Selected folder',
        videos,
        error: null,
        isLoading: false,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load local videos.'
      setState({
        isNative: true,
        isReady: true,
        hasFolder: false,
        folderName: null,
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
      await LocalVideos.pickFolder()
      await refresh()
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

  return {
    ...state,
    pickFolder,
    changeFolder,
    refresh,
  }
}
