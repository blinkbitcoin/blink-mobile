# Code audit and report

## The audit

One row per visible Figma node, top to bottom, including nodes inside matched components
(the component's own defaults count — read them). One column per property that the node
actually has; leave the rest blank.

Status:

- ✅ code matches Figma (through the mapped token)
- ⚠ token mismatch — the mapped token's value differs from Figma's; kept, reported
- ➕ new: code added for this node
- ❓ open — needs a decision; listed under *Questions*

There is no ❌ in a finished audit: every mismatch is fixed, reported as ⚠, or asked as ❓.

How to check each property:

- **Spacing**: add up what produces the gap in code (parent `gap`, child margins, padding
  of both, a component's built-in padding) and compare the total with Figma's gap or
  padding. Double counting is the most common miss.
- **Colour**: resolve `colors.<key>` in both modes from `colors.ts`, compare with the
  Figma variable's values per mode.
- **Type**: `type` gives size and line height (token-map.md); `bold` matches the style's
  weight name.
- **Size**: fixed in Figma → fixed in code; hug/fill in Figma → no hardcoded size in code.
- **Icon**: same glyph (name), size, weight, colour.
- **Copy**: rendered `en` string equals the Figma string, character for character
  (apostrophes, ellipses, capitalisation).

## Report template

```md
## <Screen/component> ← Figma <node name> (<node id>)

### Changed
- `app/…/file.tsx` — what changed, in one line each

### Audit
| Node | Code | Layout | Spacing | Colour | Type | Icon | Copy |
|---|---|---|---|---|---|---|---|
| bottom-sheet (27388:90542) | `x.tsx:40` | ✅ | ✅ px 20, gap 14 | ✅ white | | | |

### Token mismatches (kept the theme)
| Where | Figma | Theme token | Theme value |
|---|---|---|---|
| title text | grey0 #f2f2f4 (dark) | grey0 | #FAF9F9 |

### Shared components
- New optional prop `<prop>` on `<Component>` (N call sites, default unchanged), or none.

### Additive changes
- New i18n keys (all locales), new icons in `galoy-icon.tsx`.

### New UI and where it went
| Figma node | Placed in | Why there (one screen / feature / cross-feature) |

### Copy changed
| Key | Was (en) | Now (Figma) | Locales updated |

### Figma naming drift
| Figma layer / component | Code component it actually is |

### Questions

- …

### Checks
- tsc, eslint, tests: pass/fail with the failing output.
```
