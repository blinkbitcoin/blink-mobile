export const SetAddressError = {
  TOO_SHORT: "TOO_SHORT",
  TOO_LONG: "TOO_LONG",
  INVALID_CHARACTER: "INVALID_CHARACTER",
  ADDRESS_UNAVAILABLE: "ADDRESS_UNAVAILABLE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

export type SetAddressError = (typeof SetAddressError)[keyof typeof SetAddressError]

type ValidateLightningAddressResult =
  | { valid: true }
  | { valid: false; error: SetAddressError }

export const validateLightningAddress = (
  lightningAddress: string,
): ValidateLightningAddressResult => {
  if (lightningAddress.length < 3) {
    return {
      valid: false,
      error: SetAddressError.TOO_SHORT,
    }
  }

  if (lightningAddress.length > 50) {
    return {
      valid: false,
      error: SetAddressError.TOO_LONG,
    }
  }

  if (!/^[A-Za-z0-9_]+$/.test(lightningAddress)) {
    return {
      valid: false,
      error: SetAddressError.INVALID_CHARACTER,
    }
  }

  return { valid: true }
}
