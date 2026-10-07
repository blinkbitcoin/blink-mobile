import { Platform } from "react-native"
import ReactNativeHapticFeedback, {
  type HapticFeedbackTypes,
} from "react-native-haptic-feedback"

/** The library's type names, taken as literals so nothing is read from it at import. */
type HapticType = keyof typeof HapticFeedbackTypes

type HapticIntent = {
  type: HapticType
  /** Touch feedback must be silent when the device is; a payment result may override. */
  ignoreAndroidSystemSettings: boolean
}

const pick = (ios: HapticType, android: HapticType): HapticType =>
  Platform.OS === "ios" ? ios : android

/**
 * The app's haptic vocabulary. Callers name the intent, not the library type, so the
 * feel of "a key was accepted" can be retuned in one place.
 *
 * Android note: `react-native-haptic-feedback` maps its `keyboardTap`/`clockTick` types
 * through `Vibrator.vibrate(long)` with the `HapticFeedbackConstants` int as the
 * duration, so they come out as 3 ms and 4 ms buzzes rather than real system haptics.
 * Only the duration-based types carry on Android, which is why the touch intents use
 * those: `soft` is 10 ms, `impactLight` 20 ms, `rigid` 30 ms, `impactMedium` 40 ms.
 */
const INTENTS = {
  /** A keypad key that was accepted. */
  tap: {
    type: pick("selection", "soft"),
    ignoreAndroidSystemSettings: false,
  },
  /** A chip, wallet switch, currency swap, option pick, long-press copy. */
  select: {
    type: pick("selection", "impactLight"),
    ignoreAndroidSystemSettings: false,
  },
  /** A press the app refused. */
  reject: {
    type: "rigid",
    ignoreAndroidSystemSettings: false,
  },
  /** Slide-to-send committing. */
  commit: {
    type: "impactMedium",
    ignoreAndroidSystemSettings: true,
  },
  /** Payment sent or received, conversion done. */
  success: {
    type: "notificationSuccess",
    ignoreAndroidSystemSettings: true,
  },
  /** A failure the user has to act on. */
  error: {
    type: "notificationError",
    ignoreAndroidSystemSettings: true,
  },
} satisfies Record<string, HapticIntent>

const fire = ({ type, ignoreAndroidSystemSettings }: HapticIntent) =>
  ReactNativeHapticFeedback.trigger(type, { ignoreAndroidSystemSettings })

export const haptics = {
  tap: () => fire(INTENTS.tap),
  select: () => fire(INTENTS.select),
  reject: () => fire(INTENTS.reject),
  commit: () => fire(INTENTS.commit),
  success: () => fire(INTENTS.success),
  error: () => fire(INTENTS.error),
}
