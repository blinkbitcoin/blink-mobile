import { useCallback } from "react"

import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceRestriction } from "@app/hooks/use-dollar-balance-restricted"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountMode } from "@app/types/account"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"
import { AccountMigrationPreview, MigrationSupportReason } from "@app/types/migration"

import { useCustodialWalletBalances } from "./use-custodial-wallet-balances"
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
 * dollars. The new Dollar Balance is always zero: the migration only ever moves bitcoin,
 * never converts dollars, so it can never promise the user any. `hasDollarBalance` gates
 * the commit screen, which sends any remaining dollars to convert before it arms.
 */
type MigrationBalancesPreviewParams = {
  /** The provisioned account and its load state come from the screen's checkpoint
   *  instance: a second read here would refetch and let the mode lag the figures. */
  provisionedAccountId: string | null
  isProvisionedAccountLoading: boolean
}

export const useMigrationBalancesPreview = ({
  provisionedAccountId,
  isProvisionedAccountLoading,
}: MigrationBalancesPreviewParams) => {
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
  /** Both sides gate the dollar rows: rendering an unresolved region as unrestricted would
   *  show the user a Dollar Balance the new account cannot hold and then swap it for "not
   *  available" once the verdict lands, in the one step they cannot take back. The
   *  self-custodial side waits on the IP lookup, which the still-custodial session has no
   *  phone country to shortcut, so this is seconds and only the dollar rows may spend them. */
  const {
    isRestricted: isNewDollarBalanceRestricted,
    isRegionPending: isNewDollarRegionPending,
  } = useDollarBalanceRestriction(AccountType.SelfCustodial)
  const {
    isRestricted: isCurrentDollarBalanceRestricted,
    isRegionPending: isCurrentDollarRegionPending,
  } = useDollarBalanceRestriction(AccountType.Custodial)
  const isDollarRegionPending = isNewDollarRegionPending || isCurrentDollarRegionPending
  /** The chosen mode is keyed to the provisioned account (the active one is still
   *  custodial here), so it must be read by id. */
  const { getModeFor } = useSelfCustodialAccountMode()
  const isNewAccountAnon = provisionedAccountId
    ? getModeFor(provisionedAccountId) === AccountMode.Anon
    : false
  const isNewDollarBalanceUnavailable = isNewAccountAnon || isNewDollarBalanceRestricted
  const newDollarUnavailableLabel = isNewAccountAnon
    ? LL.StablesatsRestriction.anonModeWalletLabel()
    : LLOverview.dollarBalanceNotAvailable()
  /** A restricted balance still shows its amount (muted); the label only stands in when
   *  there is nothing to show. */
  const showsCurrentDollarLabel =
    isCurrentDollarBalanceRestricted && usdBalanceCents === 0

  /** The server owns the fee, the de-minimis subsidy, and the resulting amount; the
   *  client renders the preview verbatim and never does the arithmetic itself. */
  const {
    preview,
    loading: isPreviewLoading,
    isSkipped: isPreviewSkipped,
    hasConnectionIssue: hasPreviewConnectionIssue,
    refetch: refetchPreview,
  } = useMigrationPreview()

  /** The balances feed the current Dollar Balance, the preview feeds every bitcoin figure,
   *  and the checkpoint decides how the new Dollar row reads; none may render before it is
   *  known.
   *
   *  The region is deliberately not among them: on the self-custodial side it comes from an
   *  IP lookup walking its adapters, and gating the screen on it held every bitcoin figure
   *  behind seconds of spinner on the last step before an irreversible migration. The caller
   *  holds the dollar rows and Approve on `isDollarRegionPending` instead. */
  const hasPreview = preview !== null
  const isLoading = isPreviewLoading || areBalancesLoading || isProvisionedAccountLoading
  const isReady = areBalancesReady && hasPreview && !isProvisionedAccountLoading

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
    /** Whether the dollar verdict is still outstanding. The bitcoin figures do not depend on
     *  it, so it is reported apart from `isReady`: the caller holds the dollar rows and
     *  Approve on this, and renders everything else at once. */
    isDollarRegionPending,
    /** The raw figure for the checkpoint, named for what the checkpoint calls it rather
     *  than shadowing the preview field whose type it does not share. Null until ready, so
     *  a placeholder zero is never mistaken for a real zero-receive migration. */
    expectedReceiveSats: isReady ? receiveSats : null,
    isRetryable,
    isUnavailable,
    unavailableReason,
    hasDollarBalance: usdBalanceCents > 0,
    retry,
    currentBitcoinBalance: formatMoneyAmount({ moneyAmount: currentBtcAmount }),
    currentBitcoinFiat: fiatSuffix(
      moneyAmountToDisplayCurrencyString({ moneyAmount: currentBtcAmount }),
    ),
    newBitcoinBalance: formatMoneyAmount({ moneyAmount: newBtcAmount }),
    newBitcoinFiat: fiatSuffix(
      moneyAmountToDisplayCurrencyString({ moneyAmount: newBtcAmount }),
    ),
    currentDollarBalance: showsCurrentDollarLabel
      ? LLOverview.dollarBalanceNotAvailable()
      : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(usdBalanceCents) }),
    isCurrentDollarBalanceRestricted,
    newDollarBalance: isNewDollarBalanceUnavailable
      ? newDollarUnavailableLabel
      : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(0) }),
    isNewDollarBalanceUnavailable,
    networkFeeLine: feeCoveredByBlink
      ? LLOverview.networkFeeCoveredByBlink({ fee: networkFee })
      : LLOverview.networkFee({ fee: networkFee }),
  }
}
