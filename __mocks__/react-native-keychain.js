const setGenericPassword = jest.fn(() => Promise.resolve({ service: "mock-service" }))
const getGenericPassword = jest.fn(() => Promise.resolve(false))
const resetGenericPassword = jest.fn(() => Promise.resolve(true))

const setInternetCredentials = jest.fn(() => Promise.resolve({ service: "mock-service" }))
const getInternetCredentials = jest.fn(() => Promise.resolve(false))
const resetInternetCredentials = jest.fn(() => Promise.resolve(undefined))

const ACCESSIBLE = {
  WHEN_UNLOCKED: "AccessibleWhenUnlocked",
  AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock",
  ALWAYS: "AccessibleAlways",
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: "AccessibleWhenPasscodeSetThisDeviceOnly",
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
}

export {
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  setInternetCredentials,
  getInternetCredentials,
  resetInternetCredentials,
  ACCESSIBLE,
}

export default {
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  setInternetCredentials,
  getInternetCredentials,
  resetInternetCredentials,
  ACCESSIBLE,
}
