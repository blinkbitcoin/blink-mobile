import { useCallback } from "react"

import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"
import { AccountMigrationPreview, MigrationSupportReason } from "@app/types/migration"

import { useCustodialWalletBalances } from "./use-custodial-wallet-balances"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"
import { useMigrationPreview } from "./use-migration-preview"

const fiatSuffix = (fiat: string | undefined): string | undefined =>
  fiat ? ` (${fiat})` : undefined

/**
 * Stands in while the preview is still unknown, which a zero-balance preview from the
 * server is not. Its zeros never reach the screen: isReady stays false without a
 * preview, so the commit screen holds its spinner instead.
 */
const UNKNOWN_PREVIEW: AccountMigrationPreview = {
  balanceSats: 0,
  feeSats: 0,
  feeCoveredByBlink: false,
  receiveSats: 0,
}

/**
 * The commit screen's presentation model: current and resulting balances plus the
 * network fee, formatted for display. Each Dollar Balance reads "not available" (never
 * zero, never blank) when the dollar balance is restricted in the user's region for that
 * side's account type: current follows the custodial restriction, new follows the
 * self-custodial one, so a still-custodial user knows the new account will not hold
 * dollars. The exchange rate line only exists on the post-gate variant.
 */
export const useMigrationBalancesPreview = () => {
  const { LL } = useI18nContext()
  const LLOverview = LL.AccountMigration.balancesOverview

  /** cache-and-network so the dollar figure the user approves in an irreversible step is
   *  fresh: a deposit that landed after the last cache write would otherwise stay invisible
   *  here until migrationStart refuses it, a support handover instead of the empty-dollars
   *  modal. */
  const {
    usdBalanceCents,
    isReady: areBalancesReady,
    loading: areBalancesLoading,
    isSkipped: areBalancesSkipped,
    hasConnectionIssue: hasBalancesConnectionIssue,
    refetch: refetchBalances,
  } = useCustodialWalletBalances({ fetchPolicy: "cache-and-network" })
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
  const {
    preview,
    loading: isPreviewLoading,
    isSkipped: isPreviewSkipped,
    hasConnectionIssue: hasPreviewConnectionIssue,
    refetch: refetchPreview,
  } = useMigrationPreview()

  /** Both sources gate the screen: the balances feed the current Dollar Balance, the
   *  preview feeds every bitcoin figure, and neither may render before it is known. */
  const hasPreview = preview !== null
  const isLoading = isPreviewLoading || areBalancesLoading
  const isReady = areBalancesReady && hasPreview

  /**
   * A query that never ran is not an answer. Both sources skip while nobody is
   * authenticated, and a skipped query reports neither loading nor error, so reading it
   * as a settled empty answer would hand a user whose session just ended straight to
   * support with a Crashlytics report behind them. Only a query that actually ran and
   * came back with nothing counts as settled here.
   */
  const isSkipped = isPreviewSkipped || areBalancesSkipped
  const isSettledWithoutFigures = !isLoading && !isSkipped && !isReady

  /**
   * A settled failure splits by cause, because the two deserve opposite treatment. No
   * answer arrived is not the same as the answer being no: the network kind resolves
   * itself once connectivity returns, so it offers a retry and support never hears about
   * it, while the server having answered that this account has no migration is final and
   * no amount of retrying changes it. Collapsing both into a handover would send support
   * a ticket for every dropped connection.
   */
  const hasConnectionIssue = hasPreviewConnectionIssue || hasBalancesConnectionIssue
  const isRetryable = isSettledWithoutFigures && hasConnectionIssue
  const isUnavailable = isSettledWithoutFigures && !hasConnectionIssue

  /**
   * Which source left the screen without figures, as one code that serves both the
   * telemetry filed before the handover and the ticket the user carries to support, so a
   * report and its ticket can be correlated. The preview answers for the case where
   * neither source did, since every figure on the screen comes from it.
   */
  const missingFiguresReason = hasPreview
    ? MigrationSupportReason.BalancesUnavailable
    : MigrationSupportReason.PreviewUnavailable
  const unavailableReason = isUnavailable ? missingFiguresReason : null

  /**
   * Both queries feed the screen, so a retry that refreshed only one would leave the
   * other stale and drop straight back into a failed state. A refetch that fails again
   * rejects, and that rejection carries nothing the hooks' own error state does not
   * already report, so it is swallowed here rather than left to surface as an unhandled
   * rejection from a path the screen has handled.
   */
  const retry = useCallback(() => {
    Promise.all([refetchPreview(), refetchBalances()]).catch(() => undefined)
  }, [refetchPreview, refetchBalances])

  const { balanceSats, receiveSats, feeSats, feeCoveredByBlink } =
    preview ?? UNKNOWN_PREVIEW

  const currentBtcAmount = toBtcMoneyAmount(balanceSats)
  const newBtcAmount = toBtcMoneyAmount(receiveSats)
  const feeBtcAmount = toBtcMoneyAmount(feeSats)

  const formattedFee = formatMoneyAmount({ moneyAmount: feeBtcAmount })
  const feeFiat = moneyAmountToDisplayCurrencyString({
    moneyAmount: feeBtcAmount,
    isApproximate: true,
  })
  const networkFee = `${formattedFee}${fiatSuffix(feeFiat) ?? ""}`

  return {
    isReady,
    isRetryable,
    isUnavailable,
    unavailableReason,
    retry,
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
    networkFeeLine: feeCoveredByBlink
      ? LLOverview.networkFeeCoveredByBlink({ fee: networkFee })
      : LLOverview.networkFee({ fee: networkFee }),
    exchangeRate: isPostGate
      ? moneyAmountToDisplayCurrencyString({
          moneyAmount: toBtcMoneyAmount(SATS_PER_BTC),
        })
      : undefined,
  }
}
