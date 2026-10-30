const mockTrigger = jest.fn()

jest.mock("react-native-haptic-feedback", () => ({
  __esModule: true,
  default: { trigger: (...args: unknown[]) => mockTrigger(...args) },
}))

type Haptics = typeof import("@app/utils/haptics").haptics

/** The intents pick their type when the module loads, so each platform loads its own copy. */
const loadHaptics = (os: "android" | "ios"): Haptics => {
  let loaded: Haptics | undefined
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: os } }))
    loaded = jest.requireActual("@app/utils/haptics").haptics
  })
  if (!loaded) throw new Error("haptics did not load")
  return loaded
}

/**
 * Touch feedback follows the phone: on Android, a silent ringer drops every intent that
 * respects the system settings, as react-native-haptic-feedback checks the ringer mode.
 * A payment outcome and the slide-to-send commit buzz regardless. A keypad or an inline
 * refusal that went quiet in silent mode is this table working, not a lost call.
 */
const ANDROID: [intent: keyof Haptics, type: string, ignoresSettings: boolean][] = [
  ["tap", "soft", false],
  ["select", "impactLight", false],
  ["grab", "impactLight", false],
  ["reject", "rigid", false],
  ["commit", "impactMedium", true],
  ["success", "notificationSuccess", true],
  ["error", "notificationError", true],
]

describe("haptics", () => {
  beforeEach(() => mockTrigger.mockClear())

  it.each(ANDROID)(
    "plays %s on Android as %s, ignoring the system settings: %s",
    (intent, type, ignoresSettings) => {
      loadHaptics("android")[intent]()

      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith(type, {
        ignoreAndroidSystemSettings: ignoresSettings,
      })
    },
  )

  it("plays the touch intents as the system selection tick on iOS", () => {
    const haptics = loadHaptics("ios")

    haptics.tap()
    haptics.select()
    haptics.grab()

    expect(mockTrigger.mock.calls.map(([type]) => type)).toEqual([
      "selection",
      "selection",
      "selection",
    ])
  })
})
