import * as React from "react"
import { Pressable } from "react-native"
import DeviceInfo from "react-native-device-info"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useIpCountryCode, usePhoneCountryCode } from "@app/hooks/use-device-location"
import { useSecretMenuTrigger } from "@app/hooks/use-secret-menu-trigger"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"
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
  const { activeAccount } = useAccountRegistry()
  const phoneCountry = usePhoneCountryCode()
  const ipCountry = useIpCountryCode(true)
  const unknown = LL.common.unknown()

  /**
   * Registration is a custodial compliance fact, so only a custodial account has one to
   * report; a self-custodial account never registers a region and reads what the session
   * detected instead. Incognito resolves nothing, so it detects unknown.
   */
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const detectedRegion = isAnonMode ? unknown : ipCountry ?? unknown
  const countryLine = isSelfCustodial
    ? `${LL.common.detected()}: ${detectedRegion}`
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
