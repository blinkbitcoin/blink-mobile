import React from "react"
import { View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const NwcEmptyStateScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <IconHero
          icon="nostr-wallet-connect"
          iconColor={colors._green}
          title={LL.NostrWalletConnect.emptyStateHeadline()}
        />

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.NostrWalletConnect.newConnection()}
            onPress={() => navigation.navigate("nwcNewConnection")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
