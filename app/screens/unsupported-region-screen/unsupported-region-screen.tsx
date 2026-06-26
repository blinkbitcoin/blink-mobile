import * as React from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

export const UnsupportedRegionScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation()

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <GaloyIcon
            name="close"
            size={45}
            color={colors.error}
            backgroundColor={colors.grey5}
            containerSize={44}
          />
          <View style={styles.textGroup}>
            <Text style={styles.title}>{LL.UnsupportedRegionScreen.title()}</Text>
            <Text style={styles.description}>
              {LL.UnsupportedRegionScreen.description()}
            </Text>
          </View>
        </View>
        <GaloyPrimaryButton title={LL.common.close()} onPress={navigation.goBack} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  hero: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
  },
  textGroup: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    color: colors.black,
    textAlign: "center",
    maxWidth: 264,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
    maxWidth: 264,
  },
}))
