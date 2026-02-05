import * as React from "react"
import { Linking } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useTheme, makeStyles } from "@rn-vui/themed"

import { SettingsGroup } from "./group"
import { SettingsRow } from "./row"

const DASHBOARD_LINK = "https://dashboard.blink.sv"

export const ApiScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const LinkIcon = <GaloyIcon name="link" size={20} color={colors.warning} />

  const apiSettings = [
    () => (
      <SettingsRow
        title={LL.SettingsScreen.apiDocumentation()}
        leftGaloyIcon="document-outline"
        rightIcon={LinkIcon}
        action={() => Linking.openURL(DASHBOARD_LINK)}
      />
    ),
    () => (
      <SettingsRow
        title={LL.SettingsScreen.apiDashboard()}
        leftGaloyIcon="house-outline"
        rightIcon={LinkIcon}
        action={() => Linking.openURL(DASHBOARD_LINK)}
      />
    ),
  ]

  return (
    <Screen style={styles.container} preset="scroll">
      <SettingsGroup items={apiSettings} />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
}))
