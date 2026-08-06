import { useMemo } from "react"

import {
  TransactionFragment,
  TxDirection,
  WalletCurrency,
} from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import {
  addMoneyAmounts,
  DisplayCurrency,
  MoneyAmount,
  toBtcMoneyAmount,
  toWalletMoneyAmount,
} from "@app/types/amounts"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { AccountType } from "@app/types/wallet"

type Params = {
  pendingIncomingTransactions?: readonly TransactionFragment[] | null
  deposits?: readonly PendingDeposit[]
}

/** Stable empty default, so an absent deposit list does not rebuild the memo. */
const NO_DEPOSITS: readonly PendingDeposit[] = []

/**
 * The unseen-tx badge renders `settlementDisplayAmount` (locked server-side at
 * settlement time), so the pill sums the same source — otherwise the two
 * indicators show different numbers for the same receive. Returns null when any
 * transaction lacks a usable display amount or the display currencies disagree;
 * the caller then falls back to live-rate conversion, mirroring the badge's
 * own fallback in use-unseen-tx-amount-badge.ts.
 */
const sumSettlementDisplayAmounts = (
  txs: readonly TransactionFragment[],
): { amount: number; currency: string } | null => {
  let total = 0
  let currency: string | null = null
  for (const tx of txs) {
    const { settlementDisplayAmount, settlementDisplayCurrency } = tx
    if (!settlementDisplayAmount || !settlementDisplayCurrency) return null
    if (currency !== null && currency !== settlementDisplayCurrency) return null
    const amount = Number(settlementDisplayAmount)
    if (Number.isNaN(amount)) return null
    currency = settlementDisplayCurrency
    total += amount
  }
  return currency === null ? null : { amount: total, currency }
}

/**
 * Total unconfirmed incoming amount for the balance header, in display
 * currency. Custodial reads the home query's pendingIncomingTransactions;
 * self-custodial reads the immature (unconfirmed) Spark deposits passed in by
 * the screen. Claimable and errored ones stay with the UnclaimedDepositBanner,
 * which carries the action to resolve them. The screen owns the deposit fetch
 * so the header and that banner always read the same list.
 */
export const usePendingReceiveAmount = ({
  pendingIncomingTransactions,
  deposits = NO_DEPOSITS,
}: Params): { pendingReceiveAmountText: string | null } => {
  const { formatMoneyAmount, formatCurrency, currencyInfo, displayCurrency } =
    useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const { activeAccount } = useAccountRegistry()
  // Branch on the account type alone (same predicate as use-price-conversion):
  // `useActiveWallet().isSelfCustodial` also encodes SDK readiness, so it is
  // false while the Spark SDK connects — and the custodial account's pending
  // receives would leak in beside the self-custodial balance.
  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial

  // Until the currency list resolves the preferred display currency (cold
  // start with a non-USD display currency), formatMoneyAmount degrades to the
  // app-wide "Currency issue. Refresh needed" placeholder — suppress the pill
  // rather than render that inside it.
  const displayCurrencyReady =
    currencyInfo[DisplayCurrency].currencyCode === displayCurrency

  const pendingReceiveAmountText = useMemo((): string | null => {
    const formatConverted = (
      totalAmount: MoneyAmount<typeof DisplayCurrency>,
    ): string | null =>
      totalAmount.amount <= 0 ? null : formatMoneyAmount({ moneyAmount: totalAmount })

    if (isSelfCustodialAccount) {
      const immatureSats = deposits
        .filter(({ status }) => status === DepositStatus.Immature)
        .reduce((sum, { amount }) => sum + amount.amount, 0)
      if (immatureSats === 0) return null
      if (!convertMoneyAmount || !displayCurrencyReady) return null
      return formatConverted(
        convertMoneyAmount(toBtcMoneyAmount(immatureSats), DisplayCurrency),
      )
    }

    const pendingReceives = (pendingIncomingTransactions ?? []).filter(
      (tx) => tx.direction === TxDirection.Receive && tx.settlementAmount > 0,
    )
    if (pendingReceives.length === 0) return null

    const displayTotal = sumSettlementDisplayAmounts(pendingReceives)
    if (displayTotal && displayTotal.amount > 0) {
      return formatCurrency({
        amountInMajorUnits: displayTotal.amount,
        currency: displayTotal.currency,
      })
    }

    // Fallback: sum each settlement currency before converting, so per-call
    // rounding cannot floor several sub-display-unit receives to zero.
    if (!convertMoneyAmount || !displayCurrencyReady) return null
    const settlementTotals = new Map<WalletCurrency, number>()
    for (const tx of pendingReceives) {
      settlementTotals.set(
        tx.settlementCurrency,
        (settlementTotals.get(tx.settlementCurrency) ?? 0) + tx.settlementAmount,
      )
    }
    let total = convertMoneyAmount(toBtcMoneyAmount(0), DisplayCurrency)
    for (const [currency, amount] of settlementTotals) {
      total = addMoneyAmounts({
        a: total,
        b: convertMoneyAmount(toWalletMoneyAmount(amount, currency), DisplayCurrency),
      })
    }
    return formatConverted(total)
  }, [
    isSelfCustodialAccount,
    deposits,
    pendingIncomingTransactions,
    convertMoneyAmount,
    displayCurrencyReady,
    formatCurrency,
    formatMoneyAmount,
  ])

  return { pendingReceiveAmountText }
}
