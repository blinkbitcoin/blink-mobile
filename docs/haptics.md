# Haptics

Every vibration in the app goes through one helper, `app/utils/haptics.ts`. A caller names
what happened (`haptics.select()`, `haptics.success()`), and the helper decides how it feels
on each platform and whether it follows the phone's silent and vibration settings. That
way one kind of moment feels the same everywhere, and its feel can be changed in one place.

Ticket: [blinkbitcoin/blink-wip#2041](https://github.com/blinkbitcoin/blink-wip/issues/2041)
(phase 2 of #1312).

---

## 1. The vocabulary

| Intent    | Use it for                                                   | iOS type              | Android type           | On silent |
| --------- | ------------------------------------------------------------ | --------------------- | ---------------------- | --------- |
| `tap`     | A keypad key that was accepted                               | `selection`           | `soft` (10 ms)         | buzzes    |
| `select`  | A chip, wallet switch, currency swap, option pick, or a copy | `selection`           | `impactLight` (20 ms)  | silent    |
| `grab`    | Slide-to-send's handle taken, before it moves                | `selection`           | `impactLight` (20 ms)  | silent    |
| `reject`  | A press the app refused                                      | `rigid`               | `rigid` (30 ms)        | buzzes    |
| `commit`  | Slide-to-send committing                                     | `impactMedium`        | `impactMedium` (40 ms) | buzzes    |
| `success` | Payment sent or received, conversion done                    | `notificationSuccess` | `notificationSuccess`  | buzzes    |
| `error`   | A failure the user has to act on                             | `notificationError`   | `notificationError`    | buzzes    |

**On silent** is the helper's `ignoreAndroidSystemSettings`. With it on, the buzz fires
even when the ringer is silent. With it off, the library drops the buzz on a silent phone.
Only the light touches (`select`, `grab`) follow the phone. The keypad tap and the refusal
buzz anyway, so typing never feels dead and a refusal is never silent (ruled 2026-10-30).
The outcomes and the slide commit keep the setting they had before the helper existed.

**Why the Android types are duration-based:** `react-native-haptic-feedback` sends its
`keyboardTap` and `clockTick` types through `Vibrator.vibrate(long)`, using the
`HapticFeedbackConstants` integer as the duration. They come out as 3 ms and 4 ms buzzes
that most phones can't render. Only the duration-based types carry, so the touch intents
use those.

`tap`, `grab`, `reject` and `commit` have no caller on `main` yet. They are reserved for
the keypad, slide-to-send and inline-refusal work that builds on this helper.

---

## 2. Where each intent fires today

| Intent    | Call site                                                                                                        | When                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `select`  | `app/components/percentage-selector/percentage-selector.tsx`                                                     | A Convert percent chip is pressed (never a locked or disabled one)                    |
| `select`  | `app/components/receive-amount-row/receive-amount-row.tsx`                                                       | The Receive wallet toggle switches wallet                                             |
| `select`  | `app/screens/conversion-flow/conversion-details-screen.tsx` (`toggleInputs`)                                     | Convert's from/to swap, unless the screen is locked                                   |
| `select`  | `app/components/amount-input-screen/amount-input-screen-ui.tsx`                                                  | The amount modal's currency toggle, when there is one                                 |
| `select`  | `app/hooks/use-clipboard.ts` (`copyToClipboard`)                                                                 | Every copy that shows the "copied" toast, tapped or long-pressed                      |
| `select`  | `app/screens/receive-bitcoin-screen/hooks/use-payment-actions.ts`                                                | Receive's copy action                                                                 |
| `success` | `app/screens/receive-bitcoin-screen/hooks/use-invoice-lifecycle.ts`                                              | The shown invoice is paid                                                             |
| `success` | `app/hooks/use-intra-ledger-conversion.ts`, `app/screens/conversion-flow/hooks/self-custodial/use-conversion.ts` | A conversion succeeds                                                                 |
| `error`   | the same two conversion hooks                                                                                    | A conversion fails, throws or has no quote                                            |
| `success` | `app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.tsx`                                           | A send completes (`SUCCESS` or `PENDING`)                                             |
| `error`   | the same screen                                                                                                  | Already paid, a failed status, or a repeat attempt that can't be confirmed as settled |

A copy fires once: between the clipboard write and the toast, and not again when the
clipboard auto-clears. Only an actual change of choice gets the tick, so a press that
changes nothing stays silent.

---

## 3. The rule: only through the helper

`.eslintrc.json` has a `no-restricted-imports` path for `react-native-haptic-feedback`.
Importing it anywhere is a lint error, except in:

- `app/utils/haptics.ts`, the helper itself
- `__tests__/**`, because specs mock the library and assert on it

The exemption is its own override, which repeats the other restricted paths
(`react-native-secure-key-store`, `@react-native-firebase/crashlytics`), so those stay
blocked in the helper and in specs. If you add a restricted path to the base rule, add it
to every override that re-declares `no-restricted-imports` too.
`__tests__/utils/haptics-import-rule.spec.ts` runs ESLint on a direct import from a
screen, a component, a hook, the helper and a spec, so dropping the rule fails CI.

---

## 4. Adding a haptic

1. **Pick an existing intent.** Ask what the moment means, not how strong it should feel.
   A new toggle is `select`. A new outcome screen is `success` or `error`.
2. **Fire it at the UI layer, at the moment of the change.** Call it in the `onPress`
   handler before the state update, not in a `useEffect` that watches the state. An effect
   also fires on mount and on changes that came from elsewhere. Don't fire it when the
   press does nothing (a disabled or locked control, a toggle with nothing to switch to).
3. **Add a new intent only for a moment none of these describes.** Add it to `INTENTS` and
   `haptics` in `app/utils/haptics.ts`, with a comment saying when it fires. Pick a
   duration-based type for Android. Add its row to `ANDROID` in
   `__tests__/utils/haptics.spec.ts` and to the table in §1.

---

## 5. Testing

- **The helper** (`__tests__/utils/haptics.spec.ts`) mocks the library, loads the helper
  once per platform, and pins each intent's Android type and silent-mode setting, plus the
  iOS selection tick.
- **Call sites** mock the helper itself:
  `jest.mock("@app/utils/haptics", () => ({ haptics: { select: jest.fn() } }))`. Assert
  that it fires exactly once per press, and that it stays silent where the press does
  nothing. Where order matters (haptic before the selection, before the toast), record
  both calls into one array and compare the order.
- Specs written before the helper assert on the global `react-native-haptic-feedback`
  mock (`trigger("notificationSuccess", { ignoreAndroidSystemSettings: true })`). They
  still pass, because the helper calls the library with the same arguments.
