# Universal busy-state screen

A reusable full-screen "something is happening in the background" state: two icon
chips that spread apart, a dashed connector that draws between them, and a
heading + status line underneath. It replaces the bare `ActivityIndicator` used
today by screens like `WalletCreationScreen`, and is generic enough to serve any
pending/busy step (key generation, wallet restore, migration, NWC pairing).

Source of truth: Figma `9MQuQi8ZhXVvDibWSI3C4c`
— start [23646:128620](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=23646-128620),
end [23646:128717](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=23646-128717),
connector reference (NWC new-connection) [11009:39067](https://www.figma.com/design/9MQuQi8ZhXVvDibWSI3C4c/Blink?node-id=11009-39067).

---

## 1. Anatomy

```
┌──────────────────────────── Screen (preset fixed, headerless) ─────────┐
│                                                                        │
│                          (flex, centered)                              │
│                                                                        │
│              ┌─────┐ - - - - - - - - ┌─────┐   ← chip row (164 × 52)   │
│              │ key │                 │ 🐦  │                           │
│              └─────┘                 └─────┘                           │
│                            ↕ 14                                        │
│           Your backup phrase is used to create your                    │
│                        Nostr keys                    ← heading (264 w)  │
│                            ↕ 8                                         │
│                    Generating keys…                  ← status line     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Measurements (from Figma, 360pt-wide frame)

| Element                  | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| Chip                     | 52 × 52, fully round (`borderRadius: 26`)                 |
| Chip fill                | `#1D1D1D` → `colors.grey5`                                |
| Glyph inside chip        | 32 × 32 box, centred (Figma: 31×32 at x/y = 10)           |
| Connector length         | 60 (final); 0 at start                                    |
| Connector stroke         | 1px, dash `5 5`, `#BDBDBD`                                |
| Chip row total width     | 52 + 60 + 52 = **164**                                    |
| Row → text gap           | 14                                                        |
| Heading → status gap     | 8                                                         |
| Text block width         | 264, centre-aligned                                       |
| Heading                  | `Text type="h2" bold` (20/24), `colors.black` — always bold |
| Status line              | `Text type="p3"` (14/18), `#E9E8E8` → `colors.grey1`      |
| Chip-row top padding     | 10 (Figma `menu item` frame)                              |
| Screen horizontal pad    | 20                                                        |

Everything above is a design constant living in one `config.ts` beside the
component, mirroring `app/components/success-animation/config.ts`.

### Token mapping (ruled 2026-09-10)

Only themed Blink variables are used. `#BDBDBD` and the raw `#FFFFFF`/`#00A700`
from the Figma frame are not tokens and are not used directly.

| Role              | Token           | Dark      | Light     |
| ----------------- | --------------- | --------- | --------- |
| Chip background   | `colors.grey5`  | `#1D1D1D` | `#F2F2F4` |
| Connector stroke  | `colors.grey2`  | `#CCCCCC` | `#9292A0` |
| Heading           | `colors.black`  | `#FFFFFF` | `#000000` |
| Status line       | `colors.grey1`  | `#E9E8E8` | `#393939` |
| "Success" glyph   | `colors._green` | `#00A700` | `#00A700` |
| Foreground glyph  | `colors.black`  | `#FFFFFF` | `#000000` |

`colors.black` is this theme's *inverting foreground* token — it is `#FFFFFF` in
dark mode. There is no `foreground` or `success` key in `app/rne-theme/colors.ts`;
`colors.black` and `colors._green` are what the codebase already uses for those
two roles (see `backup-method-screen.tsx`, which passes `colors._green` as an
`iconColor` in this same onboarding flow). `_green` is pinned and does not invert.

---

## 2. Public API

Two layers, so the animation can be reused without the screen chrome.

### `<BusyStateAnimation />` — the chip pair + connector

```ts
type BusyChip = {
  /** Rendered inside the 52×52 chip; sized to a 32×32 box by the chip. */
  icon: React.ReactNode
  /** Chip background. Defaults to `colors.grey5`. */
  backgroundColor?: string
}

type BusyStateAnimationProps = {
  from: BusyChip
  to: BusyChip
  /** Connector stroke colour. Defaults to the themed connector token. */
  connectorColor?: string
  /** Skips the entrance and renders the resting state. Set from `useReducedMotion()`. */
  reducedMotion?: boolean
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

type BusyStateScreenProps = BusyStateAnimationProps & {
  heading: string
  /** The status line; the trailing "…" is part of the copy. */
  status: string
  completion: BusyCompletion
  /** Called once, after the floor has elapsed and the work has finished. */
  onDone: () => void
}
```

See §4 for the two floors and the mounting contract.

---

## 3. Animation timeline

The entrance is one-shot and forward-only, started from a mount effect (never a
toggled transition) so a re-render cannot animate it backwards. The connector's
dashes then march forever.

```
t=0ms      ┌──────────────── hold ────────────────────────┐
           │ one chip, centred, alone. Nothing moves.     │  300ms
t=300ms    └─────────────────────────────────────────────┘
t=300ms    ┌──────────────── entrance (one-shot) ─────────┐
           │ from-chip:  translateX  0 → −56              │  300ms, ease-in-out
           │ to-chip:    translateX  0 → +56              │  300ms, ease-in-out
           │ connector:  width       0 → 60               │  300ms, ease-in-out
t=600ms    └─────────────────────────────────────────────┘
t=300ms    ┌──────────── dash march (loops forever) ──────┐
           │ dash strip: translateX  0 → 10, repeating    │  linear, no reverse
           └─────────────────────────────────────────────┘
```

The opening hold is deliberate. The screen has usually just been pushed, so an
entrance starting at t=0 collides with the navigator's own transition and is half
missed; the pause also gives the start state — one chip, alone, no line — time to
read before the pair parts. The march is delayed by the same beat, so the
pictogram is genuinely still rather than merely hidden behind a zero-width window.

Entrance proper: **300ms**, after a 300ms hold. The connector is not a second beat — its
container widens *in lockstep with the chips*, because the container's width is
exactly the gap the chips open. The dashes are already marching inside it, so
they are revealed in motion as the gap appears, and they never stop.

### Geometry of the spread

Both chips start stacked at the row centre and translate outward by half the
final centre-to-centre distance:

```
centre-to-centre = chipSize + connectorLength = 52 + 60 = 112
half             = 56
from-chip translateX: 0 → −56
to-chip   translateX: 0 → +56
```

The row is a fixed 164 × 52 centred box, so nothing reflows — only transforms
and one width, all on the UI thread.

### The "emerging from behind" read

The to-chip is rendered **first** in the tree (lower z) and the from-chip
**second** (higher z). At t=0 they overlap exactly, so only the from-chip is
visible. As they translate apart the to-chip slides out from under it. No scale,
no fade — a z-order reveal, not a pop-in.

Android caveat: `elevation` beats sibling order on Android. Neither chip has a
shadow, so sibling order is enough — do not add `elevation` to the chips.

### The connector: marching ants (ruled 2026-09-10)

Not a `strokeDashoffset` draw-in, and not a clip-reveal. The dashes travel
key→ostrich continuously at constant speed, for the whole life of the screen.

- A dashed SVG `<Line>` is drawn one dash-period **wider** than the connector
  (60 + 10 = 70pt), `strokeDasharray={[5, 5]}`, `strokeWidth={1}`,
  `strokeLinecap="butt"`, colour `colors.grey2`.
- That strip is translated `0 → 10` (one full dash period) on a **linear**,
  infinitely repeating, non-reversing timing. Because the travel distance equals
  the pattern period, the loop is seamless — there is no visible jump at wrap.
- The strip lives in a container with `overflow: "hidden"` whose width animates
  `0 → 60` with the chip spread, so the extra 10pt is always clipped.

Constant speed comes from the linear easing on the march; the ease-in-out
applies to the gap opening, which is chip motion.

`DASH_TRAVEL_MS` (one period) is the single speed knob: 10pt per
`DASH_TRAVEL_MS`. Starting value 500ms ⇒ 20pt/s ⇒ a dash crosses the 60pt gap in
3s. This is the number most likely to need tuning on device.

### Why not `strokeDashoffset`

Animating `strokeDashoffset` on a repeating `5 5` pattern produces exactly this
marching effect, and would be one fewer view. It is avoided because in
react-native-svg an animated `strokeDashoffset` goes through `useAnimatedProps`,
which re-renders the SVG element rather than driving a transform — a per-frame
prop write for the entire life of the screen. A `translateX` on a plain view is
a pure UI-thread transform. Same pixels, cheaper.

### Steady state

After 300ms the chips are at rest and the only motion is the marching dashes.
That is the busy signal; the status line is plain text with the "…" baked into
the copy — no typewriter, no pulsing dots.

## 4. Lifecycle (ruled 2026-09-10)

Two floors, not one:

| Constant         | Value  | Meaning                                                        |
| ---------------- | ------ | -------------------------------------------------------------- |
| `MIN_VISIBLE_MS` | `600`  | Hard floor (`ENTRANCE_DELAY_MS` + `ENTRANCE_DURATION_MS`). The entrance must finish, pause included, before the screen may end. |
| `SIGNAL_MS`      | `3000` | Opt-in. For a screen that is *only* a signal, with no real work. |

```
completion:
  { kind: "pending", done: boolean }   → ends when done && ≥ MIN_VISIBLE_MS
  { kind: "timed", durationMs = SIGNAL_MS } → ends at max(durationMs, MIN_VISIBLE_MS)
```

`timed` is for signalling a background change/transfer/process that needs no user
action and has no observable completion — it holds for 3000ms so the user reads
it, then hands off. `pending` is for real async work: it ends as soon as the work
does, but never mid-entrance.

Rules:

- `onDone` fires **at most once**, guarded by a ref.
- Every timer is cleared on unmount and the timeline is cancelled with
  `cancelAnimation`, so an unmount mid-flight cannot write to a dead shared value.
- The component never navigates. It calls `onDone`; the caller navigates. That
  keeps it free of `RootStackParamList` and testable in isolation.
- **The caller must keep it mounted until `onDone`.** `{loading && <BusyState/>}`
  defeats the floor — the component unmounts the instant `loading` flips. Drive
  visibility from `onDone`, not from the work's own flag. This is called out in
  the component's docblock.

## 5. Accessibility

- The chip row is `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`
  — it is decorative.
- The text block carries `accessibilityRole="progressbar"` with
  `accessibilityLabel={heading}` and `accessibilityValue={{ text: status }}` so
  screen readers announce a busy state rather than reading two loose labels.
- `useReducedMotion()` (Reanimated) ⇒ render the resting state immediately: chips
  already apart, connector already at full width, no timeline. `onEntranceComplete`
  fires on the next frame.
- Both text colours pass AA on their backgrounds in both themes (heading is the
  theme's full-contrast text token; status is `grey1`).

---

## 6. Files

```
app/components/busy-state/
  index.ts
  config.ts                  design constants + timings
  busy-state-animation.tsx   chip pair + connector (no copy, no lifecycle)
  busy-state-chip.tsx        52×52 round chip wrapper
  busy-state-connector.tsx   the dashed line + reveal
  busy-state-screen.tsx      screen chrome + completion lifecycle
  __tests__/…
app/screens/developer-screen/…  entry point for the throwaway test screen
```

Icons are **not** owned by this component. `key-outline` already exists in
`galoy-icon`; the ostrich does not (§7.3).

---

## 7. Rulings and remaining risks

Resolved 2026-09-10:

| # | Question | Ruling |
| - | -------- | ------ |
| 1 | ease-in-out vs constant speed on the connector | **Marching ants, looping.** Ease-in-out on the chip spread (and therefore on the gap opening); linear on the dash travel. |
| 2 | `strokeDashoffset` draw-in | Dropped — it cannot draw in a repeating `5 5` pattern; it produces the marching effect, which is now what we want, via a cheaper `translateX`. |
| 3 | Ostrich icon | Not blocking. The demo uses existing `galoy-icon` names; the real glyph is the caller's problem when a production screen adopts this. |
| 4 | Minimum duration | `MIN_VISIBLE_MS = 600` (hard, = the 300ms hold plus the 300ms entrance). `SIGNAL_MS = 3000` for `timed` completions with no real work behind them. |
| 5 | Light mode / colours | Themed Blink variables only: `grey1`, `grey2`, `grey5`, `colors.black` (foreground), `colors._green` (success). No raw hexes. |

### Still open

**7.1 Interruption and failure are unspecified.** Neither Figma frame shows an
error or a cancel affordance. `WalletCreationScreen` today has a full error state
with a retry button. Proposal: this stays purely a busy screen — the caller swaps
it for its own error UI — and Android hardware back is swallowed while busy.
Needs confirmation.

**7.2 Dash speed is a guess.** `DASH_TRAVEL_MS = 500` (20pt/s) is not in Figma;
it comes from what reads as "travelling, not vibrating" at a 10pt period. Judge
it on device.

**7.3 The mounting contract is a footgun.** `{loading && <BusyStateScreen/>}`
silently defeats `MIN_VISIBLE_MS`. Documented, not enforced. If it bites in
review we make it a navigation destination instead.

**7.4 Heading/status length.** The text block is a fixed 264pt at 20/24; the
Figma heading already wraps to two lines and German will push it to four. The
group stays centred as it grows, and there is no `numberOfLines` cap — confirm
that is right rather than truncating.

**7.5 `_green` does not invert.** At `#00A700` on a light `grey5` chip
(`#F2F2F4`) it is ~3.0:1 — fine for a 32pt glyph, below AA for text. Accepted as
the codebase's existing success colour, but it is the one place light mode is
weaker than dark.

**7.6 i18n.** `heading` and `status` are passed in as strings, so this component
adds no keys. Any production adopter must add all 28 locales in the same commit.

## 8. Validation plan

A disconnected test screen, reachable from the developer screen, that renders the
busy state with:

- a control to replay the entrance,
- a toggle between `timed` and `pending` completion,
- light/dark toggle,
- a slow-locale long-string variant,

so the timing and the light-mode question can be judged on a real device before
any production screen adopts it.
