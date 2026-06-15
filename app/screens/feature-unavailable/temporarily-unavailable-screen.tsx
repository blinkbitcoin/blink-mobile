import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

export const TemporarilyUnavailableScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <Screen preset="fixed">
      <View style={styles.container} {...testProps("temporarily-unavailable-screen")}>
        <GaloyIcon name="warning" size={64} color={colors.warning} />
        <Text type="h1" style={styles.title}>
          {LL.FeatureUnavailable.SelfCustodial.title()}
        </Text>
        <Text style={styles.description}>
          {LL.FeatureUnavailable.SelfCustodial.description()}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
}))
