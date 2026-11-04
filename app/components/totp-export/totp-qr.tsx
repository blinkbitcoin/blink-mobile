import React from "react"
import { StyleProp, View, ViewStyle } from "react-native"
import QRCode from "react-native-qrcode-svg"

import { makeStyles } from "@rn-vui/themed"

type Props = {
  value: string
  size?: number
  /** Overrides the white frame around the code. */
  containerStyle?: StyleProp<ViewStyle>
}

const DEFAULT_SIZE = 200

export const QrCodeComponent = ({
  value,
  size = DEFAULT_SIZE,
  containerStyle,
}: Props) => {
  const styles = useStyles()
  return (
    <View style={[styles.spacingAround, containerStyle]}>
      <QRCode value={value} size={size} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  spacingAround: {
    padding: 20,
    backgroundColor: colors._white,
    borderRadius: 10,
  },
}))
