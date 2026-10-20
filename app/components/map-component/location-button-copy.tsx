import React from "react"
import { TouchableOpacity, View } from "react-native"
import { PermissionStatus, RESULTS } from "react-native-permissions"

import { makeStyles, useTheme } from "@rn-vui/themed"

import CenterLocationAndroid from "../../assets/icons/center-location-android.svg"

import { MAP_CONTROL_INSET } from "./map-search-bar"

// Round, so it reads as a floating action over the map rather than a card.
const BUTTON_SIZE = 44

type Props = {
  requestPermissions: () => void
  centerOnUser: () => void
  permissionStatus?: PermissionStatus
}

export default function LocationButtonCopy({
  permissionStatus,
  centerOnUser,
  requestPermissions,
}: Props) {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View testID="location-button-anchor" style={styles.button}>
      <TouchableOpacity
        testID="location-button"
        style={styles.android}
        onPress={permissionStatus === RESULTS.GRANTED ? centerOnUser : requestPermissions}
      >
        <CenterLocationAndroid height={22} width={22} fill={colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    // Measured from the bottom of the map's own half of the screen, which is the
    // top of the add-place form whenever one is open — so nothing has to raise
    // this to keep it clear of one.
    position: "absolute",
    bottom: MAP_CONTROL_INSET,
    right: MAP_CONTROL_INSET,
    zIndex: 99,
  },
  android: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
}))
