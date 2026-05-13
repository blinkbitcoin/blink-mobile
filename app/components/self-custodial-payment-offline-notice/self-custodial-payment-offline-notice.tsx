import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { Screen } from "../screen"

export const SelfCustodialPaymentOfflineNotice: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { refreshWallets } = useSelfCustodialWallet()

  const handleRetry = () => {
    refreshWallets()
  }

  return (
    <Screen>
      <View
        style={styles.container}
        {...testProps("self-custodial-payment-offline-notice")}
      >
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
          {...testProps("self-custodial-payment-offline-retry")}
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
