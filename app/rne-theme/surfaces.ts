import { Colors } from "@rn-vui/themed"

/**
 * A surface that is never a press target: a read-only field, an info card, a banner.
 * `grey5` is the tappable surface, so a static one painted `grey5` looks pressable
 * (Figma `28234:73360`). Spread it where the `backgroundColor` would go.
 */
export const staticSurface = (colors: Pick<Colors, "grey7">) => ({
  backgroundColor: colors.grey7,
})
