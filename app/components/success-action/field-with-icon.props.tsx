import { GestureResponderEvent } from "react-native"
import { IconNamesType } from "@app/components/atomic/galoy-icon"

export type FieldWithIconProps = {
  text: string
  event: (event: GestureResponderEvent) => void
  iconName: IconNamesType
  accessibilityLabel: string
}
