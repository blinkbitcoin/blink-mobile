import React, { useEffect, useState } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { QrCodeComponent } from "@app/components/totp-export"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { createReceiveOnchain } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { testProps } from "@app/utils/testProps"

export const SelfCustodialBitcoinDepositScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { sdk } = useSelfCustodialWallet()
  const { copyToClipboard } = useClipboard()

  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!sdk) return undefined
    let mounted = true
    createReceiveOnchain(sdk)()
      .then((result) => {
        if (!mounted) return
        if ("errors" in result) {
          const message = result.errors?.[0]?.message
          setError(new Error(message ?? "Unknown error"))
        } else {
          setAddress(result.address ?? null)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [sdk])

  const renderBody = (): React.ReactNode => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator />
        </View>
      )
    }
    if (error || !address) {
      return (
        <Text style={styles.errorText} {...testProps("bitcoin-deposit-error")}>
          {LL.SettingsScreen.WaysToGetPaid.loadError()}
        </Text>
      )
    }
    return (
      <>
        <Text style={styles.description}>
          {LL.SettingsScreen.WaysToGetPaid.onchainDescription()}
        </Text>
        <View style={styles.qrContainer} {...testProps("bitcoin-deposit-qr")}>
          <QrCodeComponent value={address} />
        </View>
        <TouchableOpacity
          style={styles.addressRow}
          onPress={() => copyToClipboard({ content: address })}
          {...testProps("bitcoin-deposit-copy")}
        >
          <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
            {address}
          </Text>
          <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
        </TouchableOpacity>
      </>
    )
  }

  return (
    <Screen preset="scroll" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>{renderBody()}</View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
    alignItems: "center",
  },
  description: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  qrContainer: {
    alignItems: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    width: "100%",
  },
  addressValue: {
    flex: 1,
    color: colors.black,
    fontSize: 15,
    lineHeight: 22,
  },
  centerContent: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
}))
