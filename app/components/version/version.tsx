import * as React from "react"
import { Pressable } from "react-native"
import DeviceInfo from "react-native-device-info"

import { useIpCountryCode, usePhoneCountryCode } from "@app/hooks/use-device-location"
import { useSecretMenuTrigger } from "@app/hooks/use-secret-menu-trigger"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"

const useStyles = makeStyles(({ colors }) => ({
  version: {
    color: colors.grey0,
    marginTop: 18,
    textAlign: "center",
  },
}))

export const VersionComponent = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const registeredCountry = usePhoneCountryCode() ?? LL.common.unknown()
  const detectedCountry = useIpCountryCode(true) ?? LL.common.unknown()
  const handleSecretMenuTap = useSecretMenuTrigger()

  const readableVersion = DeviceInfo.getReadableVersion()

  return (
    <Pressable onPress={handleSecretMenuTap}>
      <Text {...testProps("Version Build Text")} style={styles.version}>
        {readableVersion}
        {"\n"}
        {LL.common.registered()}: {registeredCountry} · {LL.common.detected()}:{" "}
        {detectedCountry}
        {"\n"}
        {LL.GetStartedScreen.headline()}
      </Text>
    </Pressable>
  )
}
