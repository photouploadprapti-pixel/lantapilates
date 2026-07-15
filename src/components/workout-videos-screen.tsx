'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { AppShell } from '@/components/app-shell'
import { WorkoutVideoListItem } from '@/components/workout-video-list-item'
import { WorkoutVideoPlayer } from '@/components/workout-video-player'
import { Button } from '@/components/ui/button'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { loadBodyAreasSession } from '@/lib/body-areas-session'
import { clearAllAppSession } from '@/lib/app-session'
import { filterWorkoutVideos } from '@/lib/filter-workout-videos'
import { isNativeApp } from '@/lib/is-native-app'
import { loadProfileSession } from '@/lib/profile-session'
import { WORKOUT_VIDEO_CATALOG } from '@/lib/workout-videos-catalog'
import { cn } from '@/lib/utils'
import { BODY_AREAS } from '@/types/body-area'
import type { WorkoutVideo } from '@/types/workout-video'

const labelFor = (id: string): string =>
  BODY_AREAS.find((area) => area.id === id)?.label ?? id

const subscribeNoop = () => () => {}

/**
 * Third screen: workout playlist and in-app player (no browser navigation between views).
 */
export const WorkoutVideosScreen = () => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const {
    hasFolder,
    folderName,
    videos: localVideos,
    changeFolder,
    isLoading: isLoadingLocal,
  } = useLocalVideos()

  const profile = isClient ? loadProfileSession() : null
  const bodyAreas = isClient ? loadBodyAreasSession() : null
  const hasValidBodyAreas =
    bodyAreas !== null && (bodyAreas.need.length > 0 || bodyAreas.avoid.length > 0)

  useEffect(() => {
    if (!isClient) return
    if (!profile) {
      router.replace('/')
      return
    }
    if (!hasValidBodyAreas) {
      router.replace('/session')
    }
  }, [isClient, profile, hasValidBodyAreas, router])

  const useOfflineVideos = (isNativeApp() || hasFolder) && hasFolder && localVideos.length > 0

  const videos = useMemo((): WorkoutVideo[] => {
    if (!bodyAreas) return []
    const catalog = useOfflineVideos ? localVideos : [...WORKOUT_VIDEO_CATALOG]
    return filterWorkoutVideos(catalog, bodyAreas)
  }, [bodyAreas, useOfflineVideos, localVideos])

  const activeVideo = useMemo(
    () => videos.find((video) => video.id === activeVideoId) ?? null,
    [videos, activeVideoId],
  )

  const isPlaying = activeVideo !== null

  const handleRestart = () => {
    clearAllAppSession()
    router.replace('/')
  }

  const handleChangeFocus = () => {
    router.push('/session')
  }

  const handleBackToPlaylist = () => {
    setActiveVideoId(null)
  }

  if (!isClient || !profile || !hasValidBodyAreas || !bodyAreas) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  if (useOfflineVideos && isLoadingLocal) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">
          Loading videos…
        </p>
      </div>
    )
  }

  if (isPlaying && activeVideo) {
    return (
      <AppShell title="Now Playing" mainClassName="max-w-2xl">
        <div className="space-y-6">
          <button
            type="button"
            onClick={handleBackToPlaylist}
            className={cn(
              'flex items-center gap-2 text-sm font-medium tracking-[0.1em] text-lanta-taupe',
              'uppercase transition-colors hover:text-lanta-charcoal',
            )}
          >
            <span aria-hidden="true">←</span>
            Back to playlist
          </button>

          <WorkoutVideoPlayer video={activeVideo} />

          <p className="text-center text-base font-medium leading-snug text-lanta-charcoal">
            {activeVideo.title}
          </p>
          {activeVideo.description ? (
            <p className="text-center text-sm text-lanta-charcoal/65">
              {activeVideo.description}
            </p>
          ) : null}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Your Workouts"
      subtitle={
        useOfflineVideos
          ? 'Tap a video to play from your offline library.'
          : 'Tap a video to play. Suggestions will be refined from your focus areas soon.'
      }
      mainClassName="max-w-2xl"
    >
      <div className="space-y-8">
        <div className="rounded-sm border border-lanta-sand bg-white/80 p-5">
          <p className="text-xs tracking-[0.2em] text-lanta-sage uppercase">Your focus</p>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <span className="font-medium text-emerald-700">Work on: </span>
              <span className="text-lanta-charcoal/80">
                {bodyAreas.need.length > 0
                  ? bodyAreas.need.map(labelFor).join(', ')
                  : 'None selected'}
              </span>
            </p>
            <p>
              <span className="font-medium text-red-700">Avoid: </span>
              <span className="text-lanta-charcoal/80">
                {bodyAreas.avoid.length > 0
                  ? bodyAreas.avoid.map(labelFor).join(', ')
                  : 'None selected'}
              </span>
            </p>
          </div>
        </div>

        {useOfflineVideos && folderName ? (
          <p className="text-sm text-lanta-charcoal/70">
            Videos from: <span className="font-medium text-lanta-charcoal">{folderName}</span>
          </p>
        ) : null}

        <section aria-label="Workout videos">
          <p className="mb-4 text-xs tracking-[0.2em] text-lanta-sage uppercase">
            {useOfflineVideos ? 'Your videos' : 'Recommended for you'}
          </p>
          {videos.length === 0 ? (
            <p className="rounded-sm border border-lanta-sand bg-white/80 p-5 text-sm text-lanta-charcoal/70">
              No videos found. Choose a folder that contains your workout files.
            </p>
          ) : (
            <ul className="space-y-3">
              {videos.map((video: WorkoutVideo) => (
                <li key={video.id}>
                  <WorkoutVideoListItem
                    video={video}
                    onSelect={() => setActiveVideoId(video.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-3 pt-2">
          {useOfflineVideos ? (
            <Button type="button" variant="secondary" onClick={() => void changeFolder()}>
              Change video folder
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={handleChangeFocus}>
            Change focus areas
          </Button>
          <Button type="button" variant="secondary" onClick={handleRestart}>
            Start over
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
