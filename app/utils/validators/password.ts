type PasswordValidationResult = {
  valid: boolean
  errors: PasswordIssue[]
  strength: Strength
}

const MIN_LENGTH = 12
const MIN_CHARACTER_CLASSES = 3

const PasswordIssue = {
  TooShort: "too-short",
  TooWeak: "too-weak",
  CommonPassword: "common-password",
} as const

type PasswordIssue = (typeof PasswordIssue)[keyof typeof PasswordIssue]

const Strength = {
  Weak: "weak",
  Fair: "fair",
  Strong: "strong",
} as const

type Strength = (typeof Strength)[keyof typeof Strength]

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "qwertyuiopas",
  "aaaaaaaaaaaa",
  "abcdefghijkl",
  "111111111111",
  "000000000000",
  "password1234!",
  "iloveyou1234",
  "letmein12345",
  "welcome12345",
  "monkey1234567",
  "dragon1234567",
  "master1234567",
  "qwerty1234567",
  "trustno112345",
])

const countCharacterClasses = (password: string): number => {
  let classes = 0
  if (/[a-z]/.test(password)) classes += 1
  if (/[A-Z]/.test(password)) classes += 1
  if (/[0-9]/.test(password)) classes += 1
  if (/[^a-zA-Z0-9]/.test(password)) classes += 1
  return classes
}

const computeStrength = (password: string, classes: number): Strength => {
  if (password.length < MIN_LENGTH || classes < 2) return Strength.Weak
  if (classes < MIN_CHARACTER_CLASSES) return Strength.Fair
  if (password.length >= 16 && classes >= MIN_CHARACTER_CLASSES) return Strength.Strong
  return Strength.Fair
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: PasswordIssue[] = []
  const classes = countCharacterClasses(password)

  if (password.length < MIN_LENGTH) {
    errors.push(PasswordIssue.TooShort)
  }

  if (classes < MIN_CHARACTER_CLASSES) {
    errors.push(PasswordIssue.TooWeak)
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push(PasswordIssue.CommonPassword)
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: computeStrength(password, classes),
  }
}

export { MIN_LENGTH, PasswordIssue, Strength }
export type { PasswordValidationResult }
