import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { IMarker } from "@app/screens/map-screen/btc-map-interface.ts"
import PinIcon from "@app/components/map-components/map-elements/pin-icon.tsx"
import MaterialIcon, {
  MaterialIconsIconName,
} from "@react-native-vector-icons/material-icons"

const DEFAULT_MARKER_ICON = "place"
const MARKER_SIZE = 35
const ICON_SIZE = 18

type Props = {
  pin: IMarker
  onSelect: (pin: IMarker) => void
}

/*
  ================================== todo ====================================
  we could pre-generate png markers per type instead of rendering React views.
  no react reconciliation inside <marker> component and reduces render cost
  on low-performance devices.
  we have around 100 icons here, x2 for dark mode, x2 for selected variant?
  idk
  ============================================================================
*/
const MarkerComponent = React.memo(({ pin, onSelect }: Props) => {
  const styles = useStyles()
  const { theme } = useTheme()
  const bgColor =
    theme.mode === "dark"
      ? styles.marker.backgroundColorDark
      : styles.marker.backgroundColor
  const iconName = pin.icon || DEFAULT_MARKER_ICON

  return (
    <Marker
      identifier={`pin-${pin.id}`}
      coordinate={pin.location}
      onPress={() => onSelect(pin)}
      tracksViewChanges={false}
    >
      <View style={styles.iconContainer}>
        <PinIcon size={MARKER_SIZE} color={bgColor} />
        <MaterialIcon
          name={iconName as MaterialIconsIconName}
          size={ICON_SIZE}
          style={styles.iconOverlay}
        />
      </View>
    </Marker>
  )
})
MarkerComponent.displayName = "MarkerComponent"

const useStyles = makeStyles(({ colors }) => ({
  marker: {
    backgroundColor: colors.primary,
    backgroundColorDark: "#8D9EDD",
  },
  iconContainer: {
    width: MARKER_SIZE,
    height: MARKER_SIZE + MARKER_SIZE * 0.35 + 6,
    alignItems: "center",
  },
  iconOverlay: {
    position: "absolute",
    top: (MARKER_SIZE - ICON_SIZE) / 2,
    alignSelf: "center",
    color: colors.white,
  },
}))

export default MarkerComponent
