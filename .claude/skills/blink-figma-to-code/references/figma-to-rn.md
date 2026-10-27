# Translating get_design_context output to blink-mobile

`get_design_context` returns React + Tailwind. None of it is pasted: it is a spec to read.

## Tailwind → RN style

| Tailwind | RN |
|---|---|
| `flex flex-col` / `flex` (row) | `flexDirection: "column"` (RN default) / `"row"` |
| `items-center`, `justify-center` | `alignItems`, `justifyContent` |
| `gap-[var(--gap,14px)]` | `gap: 14` |
| `p-`, `px-`, `py-`, `pt-`… | `padding`, `paddingHorizontal`, `paddingVertical`, `paddingTop`… |
| `w-full`, `self-stretch` | `alignSelf: "stretch"` or nothing (column children stretch by default) |
| `shrink-0`, `content-stretch`, `relative` | usually nothing |
| `flex-[1_0_0]`, `grow` | `flex: 1` |
| `size-full` | `flex: 1` on the root, rarely literal 100% |
| `w-[264px]` on text | almost always the frame's width minus padding; don't hardcode — let it fill |
| `rounded-[12px]`, `rounded-tl-[…]` | `borderRadius`, `borderTopLeftRadius` |
| `border-t border-[var(--grey5)]` | `borderTopWidth: 1, borderTopColor: colors.grey5` |
| `bg-[var(--x)]` | `backgroundColor: colors.<mapped x>` |
| `text-[color:var(--x)]` | `<Text color={colors.<x>}>` or style `color` |
| `text-center` | `textAlign: "center"` |
| `opacity-50` | `opacity: 0.5` |
| `absolute`, `left-1/2 -translate-x-1/2` | `position: "absolute"`, `alignSelf: "center"` |
| `leading-[0] text-[0px]` with `<span>`s inside | a mixed-style paragraph: one `<Text>` with nested `<Text>` children |
| `underline` | `textDecorationLine: "underline"` |
| `font-['Source_Sans_Pro:Bold']` | `bold` on `<Text>` |

Fixed widths and heights on containers are usually Figma's hug/fixed sizing on a 360-wide
frame. Keep a size only when the element is genuinely fixed (icon circle, pull tab,
avatar); otherwise use flex.

## Figma component props → code props

Code Connect snippets use Figma's property names. Read the component's props type and
translate; these are the ones verified so far.

### `galoy-primary-button` → `GaloyPrimaryButton` (`app/components/atomic/galoy-primary-button`)

Wraps `@rn-vui/themed` `Button`.

| Figma | Code |
|---|---|
| `text="Close"` | `title={LL.common.close()}` |
| `state="Default"` | — |
| `state="Disabled"` | `disabled` |
| `state="Loading"` | `loading` |

Secondary and tertiary (`galoy-secondary-button`, `galoy-tertiary-button`) follow the same
pattern; check their props file before using.

### `galoy-icon-button` → `GaloyIconButton` (`app/components/atomic/galoy-icon-button`)

| Figma | Code |
|---|---|
| child `galoy-icon type="info"` | `name="info"` |
| `size="large"` / `medium` / `small` | `size="large"` (icon 36) / `"medium"` (24) / `"small"` (16) |
| `withText={false}` | no `text`, or `iconOnly` |
| `text="…"` with `withText` | `text={LL…}` |
| `weight` on the icon | `weight` |
| `state="Disabled"` | `disabled` |

### `galoy-icon` → `GaloyIcon` (`app/components/atomic/galoy-icon/galoy-icon.tsx`)

`type="x"` → `name="x"`. `name` must exist in `phosphorIconMap` or `customSvgMap` in that
file; the type `IconNamesType` enforces it. Sizes: `sm` 16, `md` 24, `lg` 32, `xl` 48, or a
number. A Phosphor glyph not in the map → add one entry to `phosphorIconMap` (additive,
report it). A custom glyph not in either map → export it from Figma as SVG into
`app/assets/icons-redesign/`, import it in `galoy-icon.tsx`, add it to `customSvgMap`.

### Layer names that are app components

Seen so far: `icon-hero`, `button-group`, `bottom-sheet` (pull tab inside), `galoy-info`
(component set with `theme=dark|light`). When a layer's `data-name` matches a folder in
`app/components/`, open that component before writing any markup — it probably already
renders the whole block.

## Assets

- Icons: through `GaloyIcon`, never a downloaded PNG.
- Illustrations/images: download the asset URL from the response (it expires in 7 days),
  save under `app/assets/`, import it. Check `app/assets/` for an existing copy first.
- The screenshot is the target, never an asset.
