import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"

import { useCustodialWalletBalances } from "./use-custodial-wallet-balances"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"
import { useMigrationPreview } from "./use-migration-preview"

const fiatSuffix = (fiat: string | undefined): string | undefined =>
  fiat ? ` (${fiat})` : undefined

/**
 * The commit screen's presentation model: current and resulting balances plus the
 * network fee, formatted for display. Each Dollar Balance reads "not available" (never
 * zero, never blank) when the dollar balance is restricted in the user's region for that
 * side's account type: current follows the custodial restriction, new follows the
 * self-custodial one, so a still-custodial user knows the new account will not hold
 * dollars. The exchange rate only exists on the post-gate variant, where a
 * Dollar-to-Bitcoin conversion actually happens.
 */
export const useMigrationBalancesPreview = () => {
  const { LL } = useI18nContext()
  const LLOverview = LL.AccountMigration.balancesOverview

  const { btcBalanceSats, usdBalanceCents, isReady } = useCustodialWalletBalances()
  const { formatMoneyAmount, moneyAmountToDisplayCurrencyString } = useDisplayCurrency()
  const isPostGate = useWindDownGateArmed()
  const isNewDollarBalanceRestricted = useDollarBalanceRestricted(
    AccountType.SelfCustodial,
  )
  const isCurrentDollarBalanceRestricted = useDollarBalanceRestricted(
    AccountType.Custodial,
  )

  /** The server owns the fee, the de-minimis subsidy, and the resulting amount; the
   *  client renders the preview verbatim and never does the arithmetic itself. */
  const preview = useMigrationPreview(btcBalanceSats)

  const currentBtcAmount = toBtcMoneyAmount(preview.balanceSats)
  const newBtcAmount = toBtcMoneyAmount(preview.receiveSats)
  const feeBtcAmount = toBtcMoneyAmount(preview.feeSats)

  const feeSats = formatMoneyAmount({ moneyAmount: feeBtcAmount })
  const feeFiat = moneyAmountToDisplayCurrencyString({
    moneyAmount: feeBtcAmount,
    isApproximate: true,
  })
  const networkFee = feeFiat ? `${feeSats} (${feeFiat})` : feeSats

  return {
    isReady,
    currentBitcoinBalance: formatMoneyAmount({ moneyAmount: currentBtcAmount }),
    currentBitcoinFiat: fiatSuffix(
      moneyAmountToDisplayCurrencyString({ moneyAmount: currentBtcAmount }),
    ),
    newBitcoinBalance: formatMoneyAmount({ moneyAmount: newBtcAmount }),
    newBitcoinFiat: fiatSuffix(
      moneyAmountToDisplayCurrencyString({ moneyAmount: newBtcAmount }),
    ),
    currentDollarBalance: isCurrentDollarBalanceRestricted
      ? LLOverview.dollarBalanceNotAvailable()
      : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(usdBalanceCents) }),
    isCurrentDollarBalanceRestricted,
    newDollarBalance: isNewDollarBalanceRestricted
      ? LLOverview.dollarBalanceNotAvailable()
      : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(0) }),
    isNewDollarBalanceRestricted,
    networkFeeLine: preview.feeCoveredByBlink
      ? LLOverview.networkFeeCoveredByBlink({ fee: networkFee })
      : LLOverview.networkFee({ fee: networkFee }),
    exchangeRate: isPostGate
      ? moneyAmountToDisplayCurrencyString({
          moneyAmount: toBtcMoneyAmount(SATS_PER_BTC),
        })
      : undefined,
  }
}
