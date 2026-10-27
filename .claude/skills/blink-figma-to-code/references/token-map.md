# Figma variable → code token

From the Blink file's local `theme` collection (modes `light`, `dark`) and local text
styles, read live with `use_figma` on 2026-10-27, against `app/rne-theme/colors.ts` and
`theme.ts` on upstream main of the same day.

**Values come from the live file, never from `get_variable_defs`.** On 2026-10-27
`get_variable_defs` reported values that the file no longer had (Paragraph 3 14/20 vs live
14/18, grey2 `#bdbdbd` vs live `#cccccc`, a `Grey/7` variable that doesn't exist). Use it
for *which* variables a node uses; read their values with the script in SKILL.md step 1.

## Colour

Code names are `colors.<key>` from `useTheme()` / `makeStyles`.

| Figma variable | Code | Status |
|---|---|---|
| `background` (→ `_white` / `_black`) | `white` | ✅ screen ground; code's `white` is theme-relative |
| `foreground` (→ `_black` / `_white`) | `black` | ✅ default text colour; theme-relative |
| `_white`, `_black`, `_orange` | same | ✅ static, never invert |
| `primary` | `primary` | ✅ |
| `grey1`–`grey7` | same | ✅ |
| `grey0` | `grey0` | ⚠ Figma `#1d1d1d` / `#f2f2f4`, code `#3A3C51` / `#FAF9F9` |
| `blue5` | `blue5` | ⚠ dark: Figma `#3050c4`, code `#F0F0F7` |
| `loaderForeground` | `loaderForeground` | ⚠ Figma `#f9f9f9` / `#0f0f0f`, code `#ecebeb` / `#3c3b3b` |
| `loaderBackground` | `loaderBackground` | ⚠ dark: Figma `#3c3b3b`, code `#131313` |
| `error`, `error9`, `warning` | same | ✅ |
| `success` | `_green` | ✅ name differs |
| `warningLight` | `_warningLight` | ✅ name differs |
| `successLight`, `error0`, `primary-inactive`, `satsback-green`, `card-BG`, `backgrop` | — | no token: pick by role, report it. `primary-inactive` = a disabled primary; the code does that with `opacity: 0.5` on `primary` |

Gotchas:

- In code, `white` and `black` are *theme-relative*: `white` is the ground (black in dark
  mode), `black` is the text. Never use `_white`/`_black` for ground or text; those are
  static, for surfaces that must not invert (QR, camera).
- `grey0`–`grey7` are named by role, not lightness: `grey5` interactive surface at rest,
  `grey6` its pressed state, `grey7` static surface, `grey4` borders/dividers,
  `grey2` muted text. When Figma's fill is unbound, pick by what the element *does*.
- `get_design_context`'s `var(--x, #hex)` fallback is the **light** value even on dark
  frames. Don't read the mode from it.

## Typography

`<Text type="…" bold>` from `@rn-vui/themed`. Bold weight comes from `theme.ts`
(`"600"` on main; blink-mobile#4277 moves it to 700, matching Figma). Use `bold`, don't set
`fontWeight`, and report the gap once per run while #4277 is open.

| Figma text style | Size / line height | Code |
|---|---|---|
| `Heading 1/Regular`, `/Bold` | 24 / 32 | `type="h1"` |
| `Heading 2/Regular`, `/Bold` | 20 / 24 | `type="h2"` |
| `Paragraph 1/Regular`, `/Bold` | 18 / 24 | `type="p1"` |
| `Paragraph 2/Regular`, `/Bold` | 16 / 24 | `type="p2"` |
| `Paragraph 3/Regular`, `/Bold` | 14 / 18 | `type="p3"` |
| `Paragraph 4/Regular`, `/Bold` | 12 / 18 | `type="p4"` |
| `Paragraph 1 italic` | 18 / 24 | `type="p1"` + `fontStyle: "italic"` |
| `Paragraph 5/*` | 10 / 13 | none: local `fontSize: 10, lineHeight: 13` |
| `Heading balance` | 32 / 34 Bold | none: check the balance components first |
| `Keypad Numbers/*` | 28 / 32 | none: lives in `currency-keyboard` / `numeric-keypad` |
| `Button/1`–`4 Bold` | 20/24, 18/22, 16/20, 14/20 | the button components own these; don't restyle a button's title |

`/Bold` → `bold`. A text node with no style: match size + line height to a row above; if
nothing matches, local `fontSize`/`lineHeight` and report it.

## Spacing and radii

The app has no spacing tokens. Use the number.

| Figma variable | light / dark |
|---|---|
| `gap5` | 30 |
| `gap0` | 20 |
| `gap` | 14 |
| `gap1` | 10 |
| `gap2` | 8 |
| `gap4` | 5 |
| `gap3` | 3 |
| `body-padding` | 20 (horizontal screen padding) |
| `body-padding-top` | **0 / 10** |
| `body-padding-bottom` | **0 / 20** |
| `header-offset` | 84 (the nav header's height; comes from the navigator, not a style) |
| `Rounded-corners` | 12 |
| `rounded-corners1` | 8 |

`body-padding-top`/`-bottom` differ by mode in Figma. The app has one layout for both
themes: use the value of the mode the frame is drawn in (almost always dark) and list the
other under *Questions*.

Figma uses `gap0` for things that aren't gaps (bottom-sheet top corners are
`rounded-tl-[var(--gap0)]` = 20). Use the number; don't infer meaning from the name.
