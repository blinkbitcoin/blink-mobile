import materialIconGlyphs from "react-native-vector-icons/glyphmaps/MaterialIcons.json"

// The same JSON react-native-vector-icons feeds to its MaterialIcons component,
// so reading it here costs no extra bundle weight.
const glyphs: Record<string, number> = materialIconGlyphs

// BTC Map tags every place with a Google Material icon name, which is exactly
// what btcmap.org renders on its pins. The API spells them snake_case
// ("local_atm"); the Material Icons font spells them kebab-case ("local-atm"),
// so most names only need reshaping.
//
// A handful of BTC Map icons come from the newer Material Symbols set, which has
// no glyph in the shipped Material Icons font. Those get the closest stand-in
// rather than a blank pin — currently ~340 of ~29k places, over half of them
// dentists.
const MATERIAL_SYMBOLS_FALLBACKS: Record<string, string> = {
  "adult-content": "18-up-rating",
  "camping": "festival",
  "cooking": "soup-kitchen",
  "dentistry": "medical-services",
  "footprint": "directions-walk",
  "potted-plant": "yard",
  "raven": "pets",
  "sauna": "hot-tub",
  "surgical": "medical-services",
  "water-pump": "water-drop",
}

// BTC Map's own "we don't know what this is" icon, and one we know is present.
export const BTCMAP_FALLBACK_ICON = "question-mark"

/**
 * Resolve a BTC Map icon name to a glyph the bundled Material Icons font can
 * actually draw. The icon set is server-driven and grows without us, so an
 * unrecognised name degrades to a neutral marker instead of an empty box.
 */
export const materialIconName = (btcMapIcon?: string | null): string => {
  if (!btcMapIcon) return BTCMAP_FALLBACK_ICON

  const kebab = btcMapIcon.replace(/_/g, "-")
  if (glyphs[kebab] !== undefined) return kebab

  const fallback = MATERIAL_SYMBOLS_FALLBACKS[kebab]
  if (fallback && glyphs[fallback] !== undefined) return fallback

  return BTCMAP_FALLBACK_ICON
}
