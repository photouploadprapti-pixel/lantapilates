'use client'

import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { YouTubeVideoPlayer } from '@/components/youtube-video-player'
import { isMpegTsFileName, titleFromFileName } from '@/lib/local-video-catalog'
import { getVideoStreamUrl } from '@/lib/video-playback'
import { cn } from '@/lib/utils'
import type { WorkoutVideo } from '@/types/workout-video'

type WorkoutVideoPlayerProps = {
  video: WorkoutVideo
  className?: string
}

/**
 * Plays a workout video via YouTube, MPEG-TS (mpegts.js), or native HTML5.
 */
export const WorkoutVideoPlayer = ({ video, className }: WorkoutVideoPlayerProps) => {
  if (video.source.type === 'youtube') {
    return (
      <YouTubeVideoPlayer
        videoId={video.source.videoId}
        playlistId={video.source.playlistId}
        className={className}
      />
    )
  }

  const streamUrl = getVideoStreamUrl(video.source)
  const fileName =
    video.source.type === 'local' ? video.source.fileName ?? video.description ?? video.title : undefined

  if (streamUrl && fileName && isMpegTsFileName(fileName)) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-sm border border-lanta-sand bg-black shadow-sm',
          className,
        )}
      >
        <NativePlaylistPlayer
          videos={[
            {
              id: video.id,
              title: titleFromFileName(fileName),
              src: streamUrl,
              fileName,
            },
          ]}
          className="aspect-video w-full"
        />
      </div>
    )
  }

  if (streamUrl) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-sm border border-lanta-sand bg-black shadow-sm',
          className,
        )}
      >
        <video
          src={streamUrl}
          title={video.title}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex aspect-video items-center justify-center rounded-sm border border-lanta-sand',
        'bg-white/80 px-6 text-center text-sm text-lanta-charcoal/70',
        className,
      )}
    >
      Video playback is not available for this source yet.
    </div>
  )
}
