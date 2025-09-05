import { View } from "react-native"
import QRCode from "react-native-qrcode-svg"

import { makeStyles } from "@rn-vui/themed"

export const QrCodeComponent = ({ otpauth }: { otpauth: string }) => {
  const styles = useStyles()
  return (
    <View style={styles.spacingAround}>
      <QRCode
        value={otpauth}
        size={200}
        //   logo={require("./path/to/your/logo.png")} // Optional: If you want to include a logo within the QR code.
        //   logoSize={30}
        //   logoBackgroundColor="transparent"
      />
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
