import { View } from "react-native"
import QRCode from "react-native-qrcode-svg"

import { makeStyles } from "@rn-vui/themed"

export const QrCodeComponent = ({ value }: { value: string }) => {
  const styles = useStyles()
  return (
    <View style={styles.spacingAround}>
      <QRCode value={value} size={200} />
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
