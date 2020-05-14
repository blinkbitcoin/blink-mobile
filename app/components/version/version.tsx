import * as React from "react"
import { StyleSheet, Text } from "react-native"
import Config from "react-native-config"
import VersionNumber from "react-native-version-number"
import { palette } from "../../theme/palette"

const styles = StyleSheet.create({
  version: {
    color: palette.darkGrey,
    fontSize: 18,
    marginTop: 100,
    textAlign: "center",
  },
})

export const VersionComponent = ({ style }) => (
  <Text style={[style, styles.version]}>
    v{VersionNumber.appVersion} build {VersionNumber.buildVersion}
    {"\n"}
    network: {Config.BITCOIN_NETWORK} 
    {/* FIXME should be a props */}
  </Text>
)
