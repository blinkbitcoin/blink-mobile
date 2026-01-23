import parsePhoneNumber, { isValidPhoneNumber } from "libphonenumber-js/mobile"

export const isPhoneNumber = (phoneNumber: string): boolean => {
  try {
    if (isValidPhoneNumber(phoneNumber)) return true
    const parsed = parsePhoneNumber(phoneNumber)
    return parsed?.isValid() ?? false
  } catch {
    return false
  }
}
