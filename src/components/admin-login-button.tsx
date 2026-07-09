'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminLogin } from '@/lib/admin-session'
import { cn } from '@/lib/utils'

export type AdminLoginModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/**
 * Modal form for admin authentication.
 * @param open - Whether the modal is visible
 * @param onClose - Close handler
 * @param onSuccess - Called after successful login
 */
export const AdminLoginModal = ({ open, onClose, onSuccess }: AdminLoginModalProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!open) {
    return null
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(undefined)

    try {
      await adminLogin(email.trim(), password)
      onSuccess()
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        className="w-full max-w-md rounded-2xl bg-lanta-cream p-6 shadow-xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-login-title" className="font-display text-2xl text-lanta-charcoal">
              Admin login
            </h2>
            <p className="mt-1 text-sm text-lanta-charcoal/70">
              Sign in to manage users, tablets, and videos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-lanta-charcoal/60 hover:bg-lanta-sand/60"
            aria-label="Close admin login"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSubmit()
                }
              }}
            />
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </div>
    </div>
  )
}

type IconProps = {
  className?: string
}

/**
 * Top-right admin login trigger with optional redirect after auth.
 * @param onAuthenticated - Optional callback when login succeeds
 */
export const AdminLoginButton = ({ onAuthenticated }: { onAuthenticated?: () => void }) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full',
          'bg-white/80 text-lanta-charcoal shadow-md backdrop-blur',
          'hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/50',
          'top-[max(1rem,env(safe-area-inset-top))]',
        )}
        aria-label="Admin login"
      >
        <LoginIcon className="h-5 w-5" />
      </button>

      <AdminLoginModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => onAuthenticated?.()}
      />
    </>
  )
}

const LoginIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-none stroke-current stroke-2', className)} aria-hidden="true">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-none stroke-current stroke-2', className)} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
  </svg>
)
