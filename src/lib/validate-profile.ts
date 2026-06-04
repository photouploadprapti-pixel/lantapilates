import type { ProfileFormValues, UserProfile } from '@/types/profile'

export interface ProfileFieldErrors {
  fullName?: string
  age?: string
  heightCm?: string
  weightKg?: string
}

export interface ProfileValidationResult {
  profile: UserProfile | null
  errors: ProfileFieldErrors
}

/**
 * Validates onboarding form values and returns a typed profile.
 * @param values - Raw form strings from inputs
 */
export const validateProfileForm = (
  values: ProfileFormValues,
): ProfileValidationResult => {
  const errors: ProfileFieldErrors = {}
  const fullName = values.fullName.trim()

  if (fullName.length < 2) {
    errors.fullName = 'Please enter your full name'
  }

  const age = Number.parseInt(values.age, 10)
  if (!Number.isFinite(age) || age < 1 || age > 120) {
    errors.age = 'Enter a valid age (1–120)'
  }

  const heightCm = Number.parseFloat(values.heightCm)
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
    errors.heightCm = 'Enter height in cm (50–250)'
  }

  const weightKg = Number.parseFloat(values.weightKg)
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
    errors.weightKg = 'Enter weight in kg (20–300)'
  }

  if (Object.keys(errors).length > 0) {
    return { profile: null, errors }
  }

  return {
    profile: { fullName, age, heightCm, weightKg },
    errors: {},
  }
}
