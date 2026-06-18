import { validateCloudBackupForm } from "@app/screens/self-custodial/onboarding/cloud-backup-validation"

type Input = Parameters<typeof validateCloudBackupForm>[0]

const buildInput = (overrides: Partial<Input> = {}): Input => ({
  isEncrypted: true,
  password: "",
  confirmPassword: "",
  passwordTouched: false,
  confirmPasswordTouched: false,
  ...overrides,
})

describe("validateCloudBackupForm", () => {
  it("is valid and shows no errors when encryption is disabled", () => {
    const result = validateCloudBackupForm(
      buildInput({ isEncrypted: false, password: "short" }),
    )

    expect(result.isValid).toBe(true)
    expect(result.shouldShowPasswordError).toBe(false)
    expect(result.shouldShowConfirmPasswordError).toBe(false)
  })

  it("is invalid when encrypted with no password", () => {
    expect(validateCloudBackupForm(buildInput()).isValid).toBe(false)
  })

  it("shows the password error for a short, touched, non-empty password", () => {
    const result = validateCloudBackupForm(
      buildInput({ password: "short", passwordTouched: true }),
    )

    expect(result.shouldShowPasswordError).toBe(true)
    expect(result.isValid).toBe(false)
  })

  it("hides the password error before the field is touched", () => {
    const result = validateCloudBackupForm(buildInput({ password: "short" }))

    expect(result.shouldShowPasswordError).toBe(false)
  })

  it("hides the password error for an empty password even when touched", () => {
    const result = validateCloudBackupForm(buildInput({ passwordTouched: true }))

    expect(result.shouldShowPasswordError).toBe(false)
  })

  it("shows the confirm error for a touched, non-empty, mismatched confirm", () => {
    const result = validateCloudBackupForm(
      buildInput({
        password: "ValidPass1234!",
        confirmPassword: "different",
        confirmPasswordTouched: true,
      }),
    )

    expect(result.shouldShowConfirmPasswordError).toBe(true)
    expect(result.isValid).toBe(false)
  })

  it("hides the confirm error before the field is touched", () => {
    const result = validateCloudBackupForm(
      buildInput({ password: "ValidPass1234!", confirmPassword: "different" }),
    )

    expect(result.shouldShowConfirmPasswordError).toBe(false)
  })

  it("is valid when both passwords meet the minimum length and match", () => {
    const result = validateCloudBackupForm(
      buildInput({ password: "ValidPass1234!", confirmPassword: "ValidPass1234!" }),
    )

    expect(result.isValid).toBe(true)
    expect(result.shouldShowPasswordError).toBe(false)
    expect(result.shouldShowConfirmPasswordError).toBe(false)
  })

  it("is invalid when the confirm is empty even with a valid password", () => {
    expect(
      validateCloudBackupForm(buildInput({ password: "ValidPass1234!" })).isValid,
    ).toBe(false)
  })
})
