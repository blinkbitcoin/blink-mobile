import React, { useCallback } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { InfoRow } from "@app/components/card-screen/info-row"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import {
  useAddressScreenQuery,
  useWalletOverviewScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

/**
 * The single "Time to upgrade" intro screen rendered in three modes:
 * - voluntary: the user opted in from Settings; can close (back to the app).
 * - forcedPreDeadline: the user is in the migration cohort but the deadline has not
 *   passed; can still close and wait.
 * - gate: the account is closed server-side (post-deadline); no close, balances shown.
 */
export type MigrationMode = "voluntary" | "forcedPreDeadline" | "gate"

type MigrationRequiredScreenProps = {
  mode: MigrationMode
  onClose?: () => void
}

export const MigrationRequiredScreen: React.FC<MigrationRequiredScreenProps> = ({
  mode,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { getRouteForCheckpoint } = useMigrationCheckpoint()
  const { feedbackEmailAddress, openSupport } = useContactSupport()

  const isAuthed = useIsAuthed()
  const isGate = mode === "gate"
  const showCloseButton = !isGate
  const shouldLoadBalances = isAuthed && isGate

  const { data: addressData } = useAddressScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })
  const hasLightningAddress = Boolean(addressData?.me?.username)

  const { data: walletData } = useWalletOverviewScreenQuery({ skip: !shouldLoadBalances })
  const wallets = walletData?.me?.defaultAccount?.wallets
  const { formatMoneyAmount, formatDisplayAndWalletAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  const btcWalletAmount = toBtcMoneyAmount(getBtcWallet(wallets)?.balance ?? 0)
  const usdWalletAmount = toUsdMoneyAmount(getUsdWallet(wallets)?.balance ?? 0)
  const btcBalance = convertMoneyAmount
    ? formatDisplayAndWalletAmount({
        primaryAmount: btcWalletAmount,
        walletAmount: btcWalletAmount,
        displayAmount: convertMoneyAmount(btcWalletAmount, DisplayCurrency),
      })
    : formatMoneyAmount({ moneyAmount: btcWalletAmount })
  const usdBalance = formatMoneyAmount({ moneyAmount: usdWalletAmount })

  const handleMigrate = useCallback(() => {
    const nextRoute = hasLightningAddress
      ? "accountMigrationKeepReceiving"
      : getRouteForCheckpoint()
    navigation.navigate(nextRoute)
  }, [navigation, hasLightningAddress, getRouteForCheckpoint])

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
      return
    }
    navigation.goBack()
  }, [onClose, navigation])

  const heroIcon = isGate ? "warning" : "upgrade"
  const heroIconColor = isGate ? colors.warning : colors._green
  const heroTitle = isGate
    ? LL.AccountMigration.migrationGateTitle()
    : LL.AccountMigration.migrationRequiredTitle()

  const gateBody = (
    <RichText
      text={LL.AccountMigration.migrationGateBody({ email: feedbackEmailAddress })}
      style={styles.gateBody}
      tags={{ link: { style: styles.gateLink, onPress: openSupport } }}
    />
  )
  const subtitleByMode: Record<MigrationMode, React.ReactNode> = {
    voluntary: LL.AccountMigration.migrationRequiredBody(),
    forcedPreDeadline: LL.AccountMigration.migrationRequiredForcedBody(),
    gate: gateBody,
  }

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          {showCloseButton ? (
            <GaloyIconButton
              name="close"
              size="medium"
              backgroundColor={colors.grey5}
              onPress={handleClose}
              {...testProps("migration-close")}
            />
          ) : null}
        </View>

        <View style={styles.content}>
          <IconHero
            icon={heroIcon}
            iconColor={heroIconColor}
            title={heroTitle}
            subtitle={subtitleByMode[mode]}
          />

          {isGate ? (
            <View style={styles.balances}>
              <InfoRow label={LL.AccountMigration.bitcoinBalance()} value={btcBalance} />
              <InfoRow label={LL.AccountMigration.dollarBalance()} value={usdBalance} />
            </View>
          ) : null}
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.common.continue()}
            onPress={handleMigrate}
            {...testProps("migration-required-cta")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  content: {
    flex: 1,
    gap: 20,
  },
  balances: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 260,
    gap: 5,
    paddingHorizontal: 20,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  gateBody: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
  gateLink: {
    textDecorationLine: "underline",
    color: colors.black,
  },
}))
