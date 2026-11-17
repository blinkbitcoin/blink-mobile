// Root manual mock, applied automatically to every spec.
//
// Without it the legacy library loads for real, `NativeModules.RNSecureKeyStore`
// is undefined, and every legacy read throws a TypeError. That reads as "the
// keystore failed", not as "nothing is stored" — so the read-through helper
// would report `failed` in the default world of every consumer spec instead of
// `absent`. Rejecting with the missing-key code keeps the default state
// "absent everywhere", which is what those specs assume.
//
// Both native modules reject a missing key with code "404"
// (ios/RNSecureKeyStore.m `get`, RNSecureKeyStoreModule#get). React Native turns
// a native rejection into an Error carrying that code, so the mock does too.
const keyNotFoundError = () =>
  Object.assign(new Error("key does not present"), { code: "404" })

const get = jest.fn(() => Promise.reject(keyNotFoundError()))
const set = jest.fn(() => Promise.resolve("key stored successfully"))
const remove = jest.fn(() => Promise.resolve("cleared alias"))
const setResetOnAppUninstallTo = jest.fn(() => true)

const ACCESSIBLE = {
  WHEN_UNLOCKED: "AccessibleWhenUnlocked",
  AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock",
  ALWAYS: "AccessibleAlways",
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: "AccessibleWhenPasscodeSetThisDeviceOnly",
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  ALWAYS_THIS_DEVICE_ONLY: "AccessibleAlwaysThisDeviceOnly",
}

export { ACCESSIBLE }

export default {
  get,
  set,
  remove,
  setResetOnAppUninstallTo,
}
