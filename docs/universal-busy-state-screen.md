# Universal busy-state screen

A reusable full-screen "something is happening in the background" state: two icon
chips that spread apart, a dashed connector that marches between them, and a
title + optional body underneath. If the work fails, the same screen becomes an
error state with buttons. It replaces the bare `ActivityIndicator` used today by
screens like `WalletCreationScreen`, and is generic enough to serve any
pending/busy step (key generation, wallet restore, migration, NWC pairing).

Source of truth: Figma `9MQuQi8ZhXVvDibWSI3C4c`
— start [23646:128620](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=23646-128620),
end [23646:128717](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=23646-128717),
error [29835:120215](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=29835-120215),
connector reference (NWC new-connection) [11009:39067](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=11009-39067).

---

## 1. What a caller passes

Every adopter supplies exactly four things of its own:

| Prop    | Required | What it is                                                              |
| ------- | -------- | ----------------------------------------------------------------------- |
| `icon1` | yes      | Left chip glyph. Where the connection starts; on top at rest.           |
| `icon2` | yes      | Right chip glyph. Emerges from behind `icon1`.                          |
| `title` | yes      | `h2`, **always bold**. The caller supplies the words, never the weight. |
| `body`  | no       | `p3`, `colors.grey1`. Omitted → the title stands alone.                 |

Plus the lifecycle (`completion`, `onDone`, §5) and, when the work fails, `error`
(§4). Chip colour, connector colour, sizes, weights and spacing are not props:
they are the component's, so every flow looks the same.

Glyphs are sized `CHIP_GLYPH_SIZE` (32) and coloured by the caller, e.g.
`<GaloyIcon name="key-outline" size={CHIP_GLYPH_SIZE} color={colors._green} />`.

---

## 2. Anatomy

```
┌──────────────────────────── Screen (preset fixed, headerless) ─────────┐
│                                                                        │
│                          (flex, centered)                              │
│                                                                        │
│              ┌───────┐ - - - - - - - ┌───────┐   ← chip row (164 × 52) │
│              │ icon1 │               │ icon2 │                         │
│              └───────┘               └───────┘                         │
│                            ↕ 14                                        │
│           Your backup phrase is used to create your                    │
│                        Nostr keys                    ← title (264 w)    │
│                            ↕ 8                                         │
│                    Generating keys…                  ← body (optional)  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Measurements (from Figma, 360pt-wide frame)

| Element              | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| Chip                 | 52 × 52, fully round (`borderRadius: 26`)                   |
| Chip fill            | `#1D1D1D` → `colors.grey5`                                  |
| Glyph inside chip    | 32 × 32 box, centred (Figma: 31×32 at x/y = 10)             |
| Connector length     | 60 (final); 0 at start                                      |
| Connector stroke     | 1px, dash **`4 4`**, `#CCCCCC` → `colors.grey2`             |
| Chip row total width | 52 + 60 + 52 = **164**                                      |
| Row → text gap       | 14                                                          |
| Title → body gap     | 8                                                           |
| Text block width     | 264, centre-aligned                                         |
| Title                | `Text type="h2" bold` (20/24), `colors.black` — always bold |
| Body                 | `Text type="p3"` (14/18), `colors.grey1`                    |
| Chip-row top padding | 10 (Figma `menu item` frame)                                |
| Screen padding       | 20 horizontal, 20 bottom                                    |
| Error button group   | pinned bottom; 10 top, 20 sides/bottom, 10 between buttons  |

Every one of these is a constant in `app/components/busy-state/config.ts`.

### Token mapping

Only themed Blink variables are used. No raw hexes in the component.

| Role             | Token          | Dark      | Light     |
| ---------------- | -------------- | --------- | --------- |
| Chip background  | `colors.grey5` | `#1D1D1D` | `#F2F2F4` |
| Connector stroke | `colors.grey2` | `#CCCCCC` | `#9292A0` |
| Title            | `colors.black` | `#FFFFFF` | `#000000` |
| Body             | `colors.grey1` | `#E9E8E8` | `#393939` |
| Error glyph      | `colors.error` | `#DC2626` | `#DC2626` |
| Error button bar | `colors.white` | `#000000` | `#FFFFFF` |

`colors.black` is this theme's _inverting foreground_ token — it is `#FFFFFF` in
dark mode, and `colors.white` is the inverting background. Glyph colours for
`icon1`/`icon2` are the caller's (the demo uses `colors._green` for the key and
`colors.black` for the second glyph).

---

## 3. Public API

Two layers, so the pictogram can be reused without the screen chrome.

### `<BusyStateAnimation />` — the chip pair + connector

```ts
type BusyStateAnimationProps = {
  icon1: React.ReactNode
  icon2: React.ReactNode
  /** Fires once the entrance timeline has settled. */
  onEntranceComplete?: () => void
}
```

### `<BusyStateScreen />` — the full screen

```ts
type BusyCompletion =
  /** Real async work: ends when `done` flips true, never before MIN_VISIBLE_MS. */
  | { kind: "pending"; done: boolean }
  /** Pure signal, no observable work: holds for `durationMs` (default SIGNAL_MS). */
  | { kind: "timed"; durationMs?: number }

type BusyStateError = {
  title: string
  body?: string
  onRetry?: () => void // "Try Again"
  onBack?: () => void // "Back"
  onClose?: () => void // "Close"
}

type BusyStateScreenProps = {
  icon1: React.ReactNode
  icon2: React.ReactNode
  title: string
  body?: string
  completion: BusyCompletion
  /** Called once, after the floor has elapsed and the work has finished. */
  onDone: () => void
  /** Set when the work failed. Clear it to retry. */
  error?: BusyStateError
}
```

### Route options

Any route showing this screen sets, in its own screen options:

```ts
options={{ headerShown: false, gestureEnabled: false }}
```

`Screen`'s `headerShown` prop only drives safe-area insets — it does not hide the
navigator header. `gestureEnabled: false` stops the iOS swipe-back; the
component swallows Android's hardware back itself (§6), so neither platform can
leave mid-work.

---

## 4. Error state

Figma [29835:120215](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=29835-120215).

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                               ┌───────┐                                │
│                               │   ⚠   │   ← alert, colors.error        │
│                               └───────┘                                │
│                          Something went wrong   ← error.title          │
│                              ERR MSG HERE       ← error.body           │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                           Back                                 │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

- **Pictogram:** one chip, the `alert` glyph (`app/assets/icons-redesign/alert.svg`,
  `GaloyIcon name="alert"`) in `colors.error`. No connector, nothing moves.
- **Copy:** `error.title` (h2 bold) and optional `error.body` (p3 grey1), in the
  same column as the busy copy, so the title does not jump when the state flips.
- **Buttons:** one per handler passed. Fixed order **Try Again → Back → Close**.
  The first one present is `GaloyPrimaryButton`; the rest are
  `GaloySecondaryButton`. Labels come from `LL.common.tryAgain/back/close`, so
  the component adds no i18n keys. The group is pinned to the bottom over the
  body, as Figma draws it.
- **Lifecycle:** while `error` is set, `onDone` is held back. Clearing `error`
  (typically from `onRetry`) mounts a fresh attempt: the entrance replays and
  the `MIN_VISIBLE_MS` floor applies again.
- The component still never navigates. `onBack`/`onClose` are the caller's.

---

## 5. Animation timeline

The entrance is one-shot and forward-only, started from a mount effect (never a
toggled transition) so a re-render cannot animate it backwards. The connector's
dashes then march forever.

```
t=0ms      ┌──────────────── hold ────────────────────────┐
           │ icon1 chip, centred, alone. Nothing moves.   │  300ms
t=300ms    └─────────────────────────────────────────────┘
t=300ms    ┌──────────────── entrance (one-shot) ─────────┐
           │ icon1 chip: translateX  0 → −56              │  300ms, ease-in-out
           │ icon2 chip: translateX  0 → +56              │  300ms, ease-in-out
           │ connector:  width       0 → 60               │  300ms, ease-in-out
t=600ms    └─────────────────────────────────────────────┘
t=300ms    ┌──────────── dash march (loops forever) ──────┐
           │ dash strip: translateX  0 → 8, repeating     │  400ms, linear
           └─────────────────────────────────────────────┘
```

The opening hold is deliberate. The screen has usually just been pushed, so an
entrance starting at t=0 collides with the navigator's own transition and is half
missed. The march is delayed by the same beat, so the pictogram is genuinely
still rather than merely hidden behind a zero-width window.

### Geometry of the spread

```
centre-to-centre = chipSize + connectorLength = 52 + 60 = 112
half             = 56
```

The row is a fixed 164 × 52 centred box, so nothing reflows — only transforms
and one clipped width, all on the UI thread.

### The connector: marching ants

- A dashed SVG `<Line>` is drawn one dash period **wider** than the connector
  (60 + 8 = 68pt), `strokeDasharray={[4, 4]}`, `strokeWidth={1}`,
  `strokeLinecap="butt"`, colour `colors.grey2`.
- That strip is translated `0 → 8` (one full period) on a **linear**, infinitely
  repeating, non-reversing timing. Travel equals the period, so the wrap is
  seamless.
- It sits in an `overflow: "hidden"` window whose width animates `0 → 60` with the
  chip spread. The strip's translation subtracts the window's own inset, or the
  dashes would appear to slide backwards while the gap opens.
- `DASH_TRAVEL_MS` is the single speed knob: 8pt per 400ms = 20pt/s, unchanged
  from the original 10pt/500ms. Change it together with `DASH_PERIOD`.

Not a `strokeDashoffset` animation: in react-native-svg that goes through
`useAnimatedProps`, a per-frame SVG prop write for the life of the screen. A
`translateX` on a plain view is a pure UI-thread transform.

---

## 6. Behaving the same on iOS and Android

| Concern                        | How it is made identical                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Emerging from behind" z-order | Pinned with explicit `zIndex` (connector 0, `icon2` 1, `icon1` 2), not sibling order. No chip has a shadow or `elevation`, which on Android would override `zIndex`.                          |
| Header                         | Route sets `headerShown: false` (§3).                                                                                                                                                         |
| Leaving mid-work               | iOS: route sets `gestureEnabled: false`. Android: the component registers a `BackHandler` that swallows hardware back while busy, and on error calls `onBack`, else `onClose`, else swallows. |
| Decorative pictogram           | Both `accessibilityElementsHidden` (iOS) and `importantForAccessibility="no-hide-descendants"` (Android).                                                                                     |
| Error announcement             | `AccessibilityInfo.announceForAccessibility` on both; `accessibilityRole="alert"` alone is not spoken by VoiceOver.                                                                           |
| Dash rendering                 | SVG line, not a `borderStyle: "dashed"` view — RN draws dashed borders differently on each platform.                                                                                          |

---

## 7. Lifecycle

| Constant         | Value  | Meaning                                                                                                       |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `MIN_VISIBLE_MS` | `600`  | Hard floor (`ENTRANCE_DELAY_MS` + `ENTRANCE_DURATION_MS`). Applies to both kinds and again after every retry. |
| `SIGNAL_MS`      | `3000` | Default hold for `timed`.                                                                                     |

```
completion:
  { kind: "pending", done: boolean }        → ends when done && ≥ MIN_VISIBLE_MS
  { kind: "timed", durationMs = SIGNAL_MS } → ends at max(durationMs, MIN_VISIBLE_MS)
error set                                   → onDone held back until it clears
```

Rules:

- `onDone` fires **at most once**, guarded by a ref, across retries.
- Every timer is cleared on unmount and the timeline is cancelled with
  `cancelAnimation`.
- The component never navigates.
- **The caller must keep it mounted until `onDone`.** `{loading && <BusyState/>}`
  defeats the floor. Drive visibility from `onDone`, not from the work's own flag.

---

## 8. Accessibility

- The chip row is hidden from screen readers — it is decorative.
- Busy: the text block is `accessibilityRole="progressbar"`, label `title`, value
  `{ text: body }` when there is a body.
- Error: the text block is `accessibilityRole="alert"` and the title + body are
  announced on mount.
- `useReducedMotion()` ⇒ the resting state renders immediately, nothing moves,
  dashes included.

---

## 9. Files

```
app/components/busy-state/
  index.ts
  config.ts                  every constant above
  busy-state-chip.tsx        52×52 round grey5 chip
  busy-state-connector.tsx   dashed line + window + march
  busy-state-animation.tsx   chip pair (no copy, no lifecycle)
  busy-state-body.tsx        pictogram + title/body column, shared by both states
  busy-state-error.tsx       error state: alert chip + buttons
  busy-state-screen.tsx      screen chrome, completion lifecycle, hardware back
app/assets/icons-redesign/alert.svg   error glyph, registered as GaloyIcon "alert"
app/screens/developer-screen/busy-state-sandbox-screen.tsx   dev-only demo
__tests__/components/busy-state-screen.spec.tsx
```

---

## 10. Rulings

| #   | Date       | Question                   | Ruling                                                                                                    |
| --- | ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | 2026-09-10 | Connector motion           | **Marching ants, looping.** Ease-in-out on the chip spread; linear on the dash travel.                    |
| 2   | 2026-09-10 | `strokeDashoffset` draw-in | Dropped; `translateX` march instead.                                                                      |
| 3   | 2026-09-10 | Minimum duration           | `MIN_VISIBLE_MS = 600`, `SIGNAL_MS = 3000`.                                                               |
| 4   | 2026-09-10 | Colours                    | Themed tokens only.                                                                                       |
| 5   | 2026-11-06 | Caller API                 | Only `icon1`, `icon2`, `title` (required) and `body` (optional). Chip/connector colour overrides removed. |
| 6   | 2026-11-06 | Dash pattern               | `4 4` (was `5 5`).                                                                                        |
| 7   | 2026-11-06 | Header                     | `headerShown: false` on the route is correct.                                                             |
| 8   | 2026-11-06 | Platform parity            | Explicit `zIndex`, `gestureEnabled: false` + `BackHandler` (§6).                                          |
| 9   | 2026-11-06 | Failure                    | Built in as the error state (§4), alert glyph, Try Again / Back / Close as optional handlers.             |

### Still open

**Dash speed.** `DASH_TRAVEL_MS = 400` (20pt/s) is not in Figma. Judge on device.

**Copy length.** No `numberOfLines` cap; German wraps the title to four lines and
the group stays centred.

**`_green` on light.** The demo's key glyph at `#00A700` on light `grey5` is ~3.0:1
— fine for a 32pt glyph, below AA for text.

**Ostrich glyph.** `galoy-icon` has no Nostr glyph; the first production adopter
adds it.

**i18n.** The component adds no keys (button labels reuse `common`). Any
production adopter adds its title/body in all 28 locales in the same commit.

## 11. Demo

Developer menu → **Busy state sandbox** (dev builds only). Runs: timed, timed
with long German copy, timed title-only, pending 6s, pending 80ms (floor test),
and three failing runs — Try Again + Back, Back only (as Figma), and all three
buttons. A failing run fails once and succeeds on Try Again.
