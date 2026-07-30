import * as React from "react"
import { Pressable } from "react-native"
import DeviceInfo from "react-native-device-info"

import { useIpCountryCode, usePhoneCountryCode } from "@app/hooks/use-device-location"
import { useSecretMenuTrigger } from "@app/hooks/use-secret-menu-trigger"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
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
  const { isAnonMode } = useSelfCustodialAccountMode()
  const phoneCountry = usePhoneCountryCode()
  const ipCountry = useIpCountryCode(true)
  const unknown = LL.common.unknown()
  /** Anon Mode never resolves a region, so the footer states none instead of detecting one. */
  const countryLine = isAnonMode
    ? `${LL.common.country()}: ${unknown}`
    : `${LL.common.registered()}: ${phoneCountry ?? unknown} · ${LL.common.detected()}: ${ipCountry ?? unknown}`
  const handleSecretMenuTap = useSecretMenuTrigger()

  const readableVersion = DeviceInfo.getReadableVersion()

  return (
    <Pressable onPress={handleSecretMenuTap}>
      <Text {...testProps("Version Build Text")} style={styles.version}>
        {readableVersion}
        {"\n"}
        {countryLine}
        {"\n"}
        {LL.GetStartedScreen.headline()}
      </Text>
    </Pressable>
  )
}
