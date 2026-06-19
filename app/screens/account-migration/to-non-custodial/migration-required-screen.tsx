import React, { useCallback } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { InfoRow } from "@app/components/card-screen/info-row"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { WarningBanner } from "@app/components/warning-banner"
import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

/**
 * $0.50 is the smallest custodial dollar (Stablesats) balance that can be transferred as
 * dollars; below it the balance is sent as bitcoin instead, so the warning is shown.
 */
const MINIMUM_TRANSFERABLE_USD_CENTS = 50

export const MigrationRequiredScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { getRouteForCheckpoint } = useMigrationCheckpoint()

  const isAuthed = useIsAuthed()
  const { data } = useWalletOverviewScreenQuery({ skip: !isAuthed })
  const wallets = data?.me?.defaultAccount?.wallets
  const { formatMoneyAmount } = useDisplayCurrency()

  const btcBalance = formatMoneyAmount({
    moneyAmount: toBtcMoneyAmount(getBtcWallet(wallets)?.balance ?? 0),
  })
  const usdBalanceCents = getUsdWallet(wallets)?.balance ?? 0
  const usdBalance = formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(usdBalanceCents) })
  const isDollarBalanceBelowTransferMinimum =
    usdBalanceCents > 0 && usdBalanceCents < MINIMUM_TRANSFERABLE_USD_CENTS

  const handleMigrate = useCallback(() => {
    navigation.navigate(getRouteForCheckpoint())
  }, [navigation, getRouteForCheckpoint])

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="caret-up-circle"
            iconColor={colors.success}
            title={LL.AccountMigration.migrationRequiredTitle()}
            subtitle={LL.AccountMigration.migrationRequiredBody()}
          />

          <View style={styles.details}>
            <View style={styles.balances}>
              <InfoRow label={LL.AccountMigration.bitcoinBalance()} value={btcBalance} />
              <InfoRow label={LL.AccountMigration.dollarBalance()} value={usdBalance} />
            </View>
            {isDollarBalanceBelowTransferMinimum ? (
              <WarningBanner>
                {LL.AccountMigration.migrationRequiredSmallBalanceWarning()}
              </WarningBanner>
            ) : null}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AccountMigration.migrateNow()}
            onPress={handleMigrate}
            {...testProps("migration-required-cta")}
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
  content: {
    flex: 1,
    paddingTop: 60,
    gap: 20,
  },
  details: {
    paddingHorizontal: 20,
    gap: 20,
  },
  balances: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 260,
    gap: 5,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
