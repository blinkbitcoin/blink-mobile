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
  // 0 when a sibling already owns the screen bottom. Otherwise the system bar.
  bottomInset: number
}

export default function LocationButtonCopy({
  permissionStatus,
  centerOnUser,
  requestPermissions,
  bottomInset,
}: Props) {
  const styles = useStyles({ bottomInset })
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

const useStyles = makeStyles(({ colors }, { bottomInset }: { bottomInset: number }) => ({
  button: {
    // 20 past the obstruction, never instead of it. While the add-place form is
    // open that obstruction is 0: the form is a sibling, so this edge is already
    // its top, and adding the system bar would lift the button past 20.
    position: "absolute",
    bottom: bottomInset + MAP_CONTROL_INSET,
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
