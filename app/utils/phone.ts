import parsePhoneNumber, {
  CountryCode,
  isValidPhoneNumber,
  PhoneNumber,
} from "libphonenumber-js/mobile"

export const parseValidPhoneNumber = (
  input: string,
  countryCode?: CountryCode,
): PhoneNumber | null => {
  try {
    // extract: false stops libphonenumber from pulling a phone number out of
    // surrounding text, e.g. lightning addresses like 0777491011@bitzed.xyz
    const parsed = parsePhoneNumber(input, {
      defaultCountry: countryCode,
      extract: false,
    })
    if (parsed && parsed.isValid()) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

export const sanitizePhoneNumber = (input: string): string => {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, "")

  return trimmed.startsWith("+") ? `+${digits}` : digits
}

export const isPhoneNumber = (phoneNumber: string): boolean => {
  try {
    if (isValidPhoneNumber(phoneNumber)) return true
    const parsed = parsePhoneNumber(phoneNumber, { extract: false })
    return parsed?.isValid() ?? false
  } catch {
    return false
  }
}
