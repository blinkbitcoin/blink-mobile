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
    const parsed = parsePhoneNumber(input, countryCode)
    if (parsed && parsed.isValid()) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

export const isPhoneNumber = (phoneNumber: string): boolean => {
  try {
    if (isValidPhoneNumber(phoneNumber)) return true
    const parsed = parsePhoneNumber(phoneNumber)
    return parsed?.isValid() ?? false
  } catch {
    return false
  }
}
