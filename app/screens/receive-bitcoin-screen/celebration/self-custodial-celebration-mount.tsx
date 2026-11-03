import { useEffect, useMemo, useRef, useState } from "react"

import { SdkEvent_Tags as SdkEventTags } from "@breeztech/breez-sdk-spark-react-native"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { toTransactionFragment } from "@app/self-custodial/mappers/to-transaction-fragment"
import {
  isKnownPayment,
  mapSelfCustodialTransaction,
} from "@app/self-custodial/mappers/transaction"
import { paymentIdFromEventKey } from "@app/self-custodial/providers/sdk-events"
import { onSucceededPayment } from "@app/self-custodial/providers/succeeded-payments"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

import { useReceiveCelebration } from "./receive-celebration-provider"
import { CelebrationCandidate, CelebrationPaymentType } from "./types"

const SUCCEEDED_PREFIX = `${SdkEventTags.PaymentSucceeded}:`

/**
 * Self-custodial receives never come through GraphQL: they are the SDK's own
 * PaymentSucceeded events. Pending events are ignored. The payment the event carries is
 * celebrated at once, without waiting for the wallet refresh the event triggers (seconds
 * on a busy wallet). The event key is the fallback: its id waits in a queue until the
 * payment shows up in the transactions, and the provider drops whichever comes second. A
 * claimed on-chain deposit arrives the same way, as a succeeded payment.
 */
export const SelfCustodialCelebrationMount = () => {
  const { isSelfCustodial } = useActiveWallet()
  const { lastPaymentEventKey, allTransactions } = useSelfCustodialWallet()
  const { celebrate, refresh } = useReceiveCelebration()
  const { convertMoneyAmount, displayCurrency } = usePriceConversion()
  const { fractionDigits } = useDisplayCurrency()

  const [pendingIds, setPendingIds] = useState<readonly string[]>([])
  /** The key the provider already held at mount is history, not a new payment. */
  const initialKey = useRef(lastPaymentEventKey)
  /** The last payment offered, so a note that lands after it can still reach the screen. */
  const offered = useRef<{ id: string; memo: string | undefined } | null>(null)

  useEffect(() => {
    if (!isSelfCustodial || !lastPaymentEventKey) return
    if (lastPaymentEventKey === initialKey.current) return
    if (!lastPaymentEventKey.startsWith(SUCCEEDED_PREFIX)) return
    const id = paymentIdFromEventKey(lastPaymentEventKey)
    if (!id) return
    setPendingIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
  }, [isSelfCustodial, lastPaymentEventKey])

  const displayInfo = useMemo(
    () =>
      convertMoneyAmount
        ? { displayCurrency, convertMoneyAmount, fractionDigits }
        : undefined,
    [convertMoneyAmount, displayCurrency, fractionDigits],
  )

  const toCandidate = useMemo(
    () =>
      displayInfo &&
      ((tx: NormalizedTransaction): CelebrationCandidate => ({
        transaction: toTransactionFragment(tx, displayInfo),
        paymentType:
          tx.paymentType === PaymentType.Onchain
            ? CelebrationPaymentType.Onchain
            : CelebrationPaymentType.Lightning,
        createdAtIsSettlement: true,
      })),
    [displayInfo],
  )

  const isCelebratable = (tx: NormalizedTransaction) =>
    tx.direction === TransactionDirection.Receive &&
    tx.status === TransactionStatus.Completed &&
    !tx.isConversion

  useEffect(() => {
    if (!isSelfCustodial || !toCandidate) return
    return onSucceededPayment((payment) => {
      if (!isKnownPayment(payment)) return
      const tx = mapSelfCustodialTransaction(payment)
      if (!isCelebratable(tx)) return
      offered.current = { id: tx.id, memo: tx.memo }
      celebrate(toCandidate(tx))
    })
  }, [isSelfCustodial, toCandidate, celebrate])

  useEffect(() => {
    if (!toCandidate) return

    const last = offered.current
    if (last) {
      const tx = allTransactions.find((candidate) => candidate.id === last.id)
      if (tx && tx.memo !== last.memo) {
        offered.current = { id: tx.id, memo: tx.memo }
        refresh(toCandidate(tx))
      }
    }

    if (pendingIds.length === 0) return
    /** The Succeeded event lands before the refresh it triggers, so the list can still
     *  hold the payment as Pending: it keeps waiting until the list catches up. */
    const settled = pendingIds
      .map((id) => allTransactions.find((candidate) => candidate.id === id))
      .filter(
        (tx): tx is NormalizedTransaction =>
          Boolean(tx) && tx?.status !== TransactionStatus.Pending,
      )
    if (settled.length === 0) return
    setPendingIds((ids) => ids.filter((id) => !settled.some((tx) => tx.id === id)))

    settled.filter(isCelebratable).forEach((tx) => {
      offered.current = { id: tx.id, memo: tx.memo }
      celebrate(toCandidate(tx))
    })
  }, [pendingIds, allTransactions, toCandidate, celebrate, refresh])

  return null
}
