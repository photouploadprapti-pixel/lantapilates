'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfileSession } from '@/lib/profile-session'
import {
  validateProfileForm,
  type ProfileFieldErrors,
} from '@/lib/validate-profile'
import type { ProfileFormValues } from '@/types/profile'

const INITIAL_VALUES: ProfileFormValues = {
  fullName: '',
  age: '',
  heightCm: '',
  weightKg: '',
}

/**
 * First-screen onboarding: collects profile metrics on every app start.
 */
export const ProfileFormScreen = () => {
  const router = useRouter()
  const [values, setValues] = useState<ProfileFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof ProfileFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    const result = validateProfileForm(values)
    if (!result.profile) {
      setErrors(result.errors)
      setIsSubmitting(false)
      return
    }

    saveProfileSession(result.profile)
    router.push('/session')
  }

  return (
    <AppShell
      title="Welcome"
      subtitle="On-demand reformer Pilates — your way, every day. Tell us a little about you to get started."
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Your full name"
            value={values.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          />
          {errors.fullName ? (
            <p id="fullName-error" className="text-sm text-red-700" role="alert">
              {errors.fullName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              name="age"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              placeholder="Years"
              value={values.age}
              onChange={(e) => updateField('age', e.target.value)}
              aria-invalid={Boolean(errors.age)}
              aria-describedby={errors.age ? 'age-error' : undefined}
            />
            {errors.age ? (
              <p id="age-error" className="text-sm text-red-700" role="alert">
                {errors.age}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="heightCm">Height (cm)</Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              inputMode="decimal"
              min={50}
              max={250}
              step="0.1"
              placeholder="e.g. 165"
              value={values.heightCm}
              onChange={(e) => updateField('heightCm', e.target.value)}
              aria-invalid={Boolean(errors.heightCm)}
              aria-describedby={errors.heightCm ? 'height-error' : undefined}
            />
            {errors.heightCm ? (
              <p id="height-error" className="text-sm text-red-700" role="alert">
                {errors.heightCm}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="weightKg">Weight (kg)</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              inputMode="decimal"
              min={20}
              max={300}
              step="0.1"
              placeholder="e.g. 62"
              value={values.weightKg}
              onChange={(e) => updateField('weightKg', e.target.value)}
              aria-invalid={Boolean(errors.weightKg)}
              aria-describedby={errors.weightKg ? 'weight-error' : undefined}
            />
            {errors.weightKg ? (
              <p id="weight-error" className="text-sm text-red-700" role="alert">
                {errors.weightKg}
              </p>
            ) : null}
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Continuing…' : 'Continue'}
          </Button>
        </div>
      </form>
    </AppShell>
  )
}
