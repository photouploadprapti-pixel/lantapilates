export interface NameValidationResult {
  fullName: string | null
  error?: string
}

/**
 * Validates the welcome-screen full name input.
 * @param value - Raw name string from the input
 */
export const validateDisplayName = (value: string): NameValidationResult => {
  const fullName = value.trim()
  if (fullName.length < 2) {
    return { fullName: null, error: 'Please enter your full name' }
  }
  return { fullName }
}
