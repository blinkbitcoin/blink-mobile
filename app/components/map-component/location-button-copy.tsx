import React from "react"
import { TouchableOpacity, View } from "react-native"
import { PermissionStatus, RESULTS } from "react-native-permissions"

import { makeStyles } from "@rn-vui/themed"

import CenterLocationAndroid from "../../assets/icons/center-location-android.svg"

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

  return (
    <View style={styles.button}>
      <TouchableOpacity
        testID="location-button"
        style={styles.android}
        onPress={permissionStatus === RESULTS.GRANTED ? centerOnUser : requestPermissions}
      >
        <CenterLocationAndroid height={22} width={22} fill={"#656565"} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    position: "absolute",
    // Sits above the ODbL credit, which shares this corner. The gap is bigger
    // than the credit needs at default text size so that scaling it up — it is
    // an attribution we are obliged to keep legible — moves it behind nothing.
    bottom: 48,
    right: 8,
    zIndex: 99,
  },
  android: {
    borderRadius: 2,
    opacity: 0.99,
    backgroundColor: colors.white,
    padding: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
}))
