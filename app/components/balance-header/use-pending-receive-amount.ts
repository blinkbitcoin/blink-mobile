import { useMemo } from "react"

import { TransactionFragment, TxDirection } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePendingDeposits } from "@app/self-custodial/hooks"
import {
  addMoneyAmounts,
  DisplayCurrency,
  MoneyAmount,
  toBtcMoneyAmount,
  toWalletMoneyAmount,
} from "@app/types/amounts"
import { DepositStatus } from "@app/types/payment"

type Params = {
  pendingIncomingTransactions?: readonly TransactionFragment[] | null
}

/**
 * Total unconfirmed incoming amount for the balance header, in display
 * currency. Custodial reads the home query's pendingIncomingTransactions;
 * self-custodial reads immature (unconfirmed) Spark deposits — claimable and
 * errored deposits stay with the UnclaimedDepositBanner, which carries the
 * action to resolve them.
 */
export const usePendingReceiveAmount = ({
  pendingIncomingTransactions,
}: Params): { pendingReceiveAmountText: string | null } => {
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const { isSelfCustodial } = useActiveWallet()
  const { deposits } = usePendingDeposits()

  const totalPendingDisplayAmount = useMemo(():
    | MoneyAmount<typeof DisplayCurrency>
    | undefined => {
    if (!convertMoneyAmount) return undefined

    if (isSelfCustodial) {
      const immatureSats = deposits
        .filter(({ status }) => status === DepositStatus.Immature)
        .reduce((sum, { amount }) => sum + amount.amount, 0)
      if (immatureSats === 0) return undefined
      return convertMoneyAmount(toBtcMoneyAmount(immatureSats), DisplayCurrency)
    }

    const pendingReceives = (pendingIncomingTransactions ?? []).filter(
      (tx) => tx.direction === TxDirection.Receive && tx.settlementAmount > 0,
    )
    if (pendingReceives.length === 0) return undefined
    return pendingReceives.reduce(
      (total, tx) =>
        addMoneyAmounts({
          a: total,
          b: convertMoneyAmount(
            toWalletMoneyAmount(tx.settlementAmount, tx.settlementCurrency),
            DisplayCurrency,
          ),
        }),
      convertMoneyAmount(toBtcMoneyAmount(0), DisplayCurrency),
    )
  }, [convertMoneyAmount, isSelfCustodial, deposits, pendingIncomingTransactions])

  if (!totalPendingDisplayAmount || totalPendingDisplayAmount.amount <= 0) {
    return { pendingReceiveAmountText: null }
  }

  return {
    pendingReceiveAmountText: formatMoneyAmount({
      moneyAmount: totalPendingDisplayAmount,
    }),
  }
}
