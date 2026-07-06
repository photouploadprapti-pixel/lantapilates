'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { LantaLogo } from '@/components/lanta-logo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveNameSession } from '@/lib/name-session'
import { cn } from '@/lib/utils'
import { validateDisplayName } from '@/lib/validate-name'

/**
 * Landing screen: logo, name input, and play action that opens the video player.
 */
export const WelcomeScreen = () => {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isStarting, setIsStarting] = useState(false)

  const handlePlay = () => {
    setIsStarting(true)
    const result = validateDisplayName(fullName)
    if (!result.fullName) {
      setError(result.error)
      setIsStarting(false)
      return
    }

    saveNameSession(result.fullName)
    router.push('/play')
  }

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center bg-lanta-cream px-6',
        'pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]',
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <LantaLogo size="lg" />

        <p className="mt-6 text-center text-base leading-relaxed text-lanta-charcoal/70">
          On-demand reformer Pilates — your way, every day.
        </p>

        <div className="mt-12 w-full space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value)
              setError(undefined)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handlePlay()
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'fullName-error' : undefined}
          />
          {error ? (
            <p id="fullName-error" className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handlePlay}
          disabled={isStarting}
          className={cn(
            'mt-10 flex h-20 w-20 items-center justify-center rounded-full',
            'bg-lanta-taupe text-white shadow-md transition-transform',
            'hover:scale-105 hover:bg-lanta-taupe/90 active:scale-95',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
          )}
          aria-label="Play workout"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
