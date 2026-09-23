import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { useSelfCustodialWallet } from "../providers/wallet"

export const PaymentOfflineNotice: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { refreshWallets, retry, sdk } = useSelfCustodialWallet()

  /**
   * Which retry depends on whether anything ever connected.
   *
   * `refreshWallets` returns on its first line when there is no SDK, so on the
   * statuses this screen shows for a wallet that never started — a keystore that
   * would not answer, a network marker that could not be verified — the button
   * could not succeed however often it was pressed. `retry` re-runs the
   * lifecycle, which is the only thing that reaches those.
   *
   * With a live SDK the screen means what it always meant, offline with a
   * connected wallet, and refreshing is the right answer.
   */
  const handleRetry = () => {
    if (sdk) {
      refreshWallets()
      return
    }
    retry()
  }

  return (
    <Screen>
      <View style={styles.container} {...testProps("payment-offline-notice")}>
        <View style={styles.iconWrapper}>
          <GaloyIcon name="warning" size={48} color={colors.warning} />
        </View>
        <Text type="h2" style={styles.title}>
          {LL.SelfCustodialOffline.title()}
        </Text>
        <Text type="p1" style={styles.description}>
          {LL.SelfCustodialOffline.description()}
        </Text>
        <GaloyPrimaryButton
          title={LL.SelfCustodialOffline.retry()}
          onPress={handleRetry}
          containerStyle={styles.retryButton}
          {...testProps("payment-offline-retry")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrapper: {
    marginBottom: 8,
  },
  title: {
    textAlign: "center",
    fontWeight: "600",
  },
  description: {
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    width: "100%",
  },
}))
