import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * 23 files under `app/` call `KeyStoreWrapper`, and ~26 specs mock it as a
 * partial object literal holding only the methods their subject calls. None of
 * them name the underlying library. So as long as this surface only ever grows,
 * swapping the storage backend under it (blinkbitcoin/blink-wip#1143) touches
 * one file and no consumer at all.
 *
 * This spec is what makes that a checked property rather than an intention: a
 * rename, a removal or a signature move shows up here first, in a failure whose
 * message names the member. Adding a method is expected and safe, and updating
 * the list below is the deliberate act that records it.
 */
const PINNED_SURFACE = [
  "ACTIVE_TOKEN",
  "IS_BIOMETRICS_ENABLED",
  "LEGACY_PIN_ATTEMPTS",
  "MIGRATED_ACCESSIBLE",
  "MNEMONIC",
  "MNEMONIC_NETWORK",
  "PIN",
  "PIN_FAILURE_STATE",
  "SESSION_PROFILES",
  "clearPinFailureState",
  "clearUninstallSurvivingCredentials",
  "deleteMnemonicForAccount",
  "erase",
  "getActiveToken",
  "getIsBiometricsEnabled",
  "getIsPinEnabled",
  "getMnemonicForAccount",
  "getMnemonicNetworkForAccount",
  "getPin",
  "getPinFailureState",
  "getSessionProfiles",
  "length",
  "migratedErase",
  "migratedRead",
  "migratedReadWithStatus",
  "migratedWrite",
  "mnemonicKeyFor",
  "mnemonicNetworkKeyFor",
  "name",
  "parsePinFailureState",
  "prototype",
  "read",
  "readActiveToken",
  "readIsBiometricsEnabled",
  "readIsPinEnabled",
  "readSessionProfiles",
  "readWithStatus",
  "removeActiveToken",
  "removeIsBiometricsEnabled",
  "removePin",
  "removeSessionProfileByToken",
  "removeSessionProfiles",
  "saveSessionProfiles",
  "setActiveToken",
  "setIsBiometricsEnabled",
  "setMnemonicForAccount",
  "setMnemonicNetworkForAccount",
  "setPin",
  "setPinFailureState",
  "slotFor",
  "write",
]

/** Everything on the class that is a method rather than a constant. */
const CALLABLE_MEMBERS = PINNED_SURFACE.filter((member) => {
  const isClassInternal = ["length", "name", "prototype"].includes(member)
  const isSlotNameConstant = member === member.toUpperCase()
  return !isClassInternal && !isSlotNameConstant
})

/** Private statics are part of the surface but absent from the public type. */
const surfaceOf = (target: typeof KeyStoreWrapper): Record<string, unknown> =>
  target as unknown as Record<string, unknown>

describe("KeyStoreWrapper API stability", () => {
  it("still exposes every pinned member, so no consumer mock has gone stale", () => {
    const surface = Object.getOwnPropertyNames(KeyStoreWrapper)

    expect(surface).toEqual(expect.arrayContaining(PINNED_SURFACE))
  })

  it("exposes exactly the pinned surface, so a new member is a deliberate act", () => {
    expect(Object.getOwnPropertyNames(KeyStoreWrapper).sort()).toEqual(PINNED_SURFACE)
  })

  it("keeps every pinned method callable, not merely present", () => {
    const surface = surfaceOf(KeyStoreWrapper)

    CALLABLE_MEMBERS.forEach((method) => {
      expect(typeof surface[method]).toBe("function")
    })
  })
})
