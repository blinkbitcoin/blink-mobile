import { useEffect, useMemo, useRef } from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  isKnownPayment,
  mapSelfCustodialTransaction,
} from "@app/self-custodial/mappers/transaction"
import { onNewDeposits } from "@app/self-custodial/providers/new-deposits"
import { onSucceededPayment } from "@app/self-custodial/providers/succeeded-payments"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

import { useIncomingTransactionSplash } from "./incoming-transaction-splash-context"
import {
  selfCustodialCandidate,
  selfCustodialDepositCandidate,
} from "./self-custodial-candidate"

/**
 * Self-custodial receives never come through GraphQL: they are the SDK's own
 * PaymentSucceeded events. Pending events are ignored. The payment the event carries is
 * shown at once, without waiting for the wallet refresh the event triggers (seconds
 * on a busy wallet), with Details inactive until that refresh lists it: the details
 * screen reads the wallet's list, so it could not find it before.
 * On-chain is different: a deposit gets its pending splash when the SDK first sees it,
 * and the succeeded payment its claim turns into later is not a splash.
 */
export const SelfCustodialSplashMount = () => {
  const { isSelfCustodial } = useActiveWallet()
  const { allTransactions } = useSelfCustodialWallet()
  const { showSplash, showSplashes, refresh } = useIncomingTransactionSplash()
  const { convertMoneyAmount, displayCurrency } = usePriceConversion()
  const { fractionDigits } = useDisplayCurrency()

  /** The last payment put on screen, so a note that lands after it, the refresh that lets
   *  Details open it, or a price that loads after it, can still reach the screen. */
  const offered = useRef<{
    id: string
    memo: string | undefined
    detailsPending: boolean
    unpriced: boolean
  } | null>(null)
  /** Read from the event listener without resubscribing on every refresh. */
  const listed = useRef(allTransactions)
  listed.current = allTransactions

  const displayInfo = useMemo(
    () =>
      convertMoneyAmount
        ? { displayCurrency, convertMoneyAmount, fractionDigits }
        : undefined,
    [convertMoneyAmount, displayCurrency, fractionDigits],
  )

  const toCandidate = useMemo(
    () => (tx: NormalizedTransaction) => selfCustodialCandidate(tx, displayInfo),
    [displayInfo],
  )

  const isSplashCandidate = (tx: NormalizedTransaction) =>
    tx.direction === TransactionDirection.Receive &&
    tx.status === TransactionStatus.Completed &&
    tx.paymentType !== PaymentType.Onchain &&
    !tx.isConversion

  useEffect(() => {
    if (!isSelfCustodial) return
    return onNewDeposits((deposits) =>
      showSplashes(
        deposits
          .filter((deposit) => !deposit.refundTxId)
          .map((deposit) =>
            selfCustodialDepositCandidate(deposit, Date.now(), displayInfo),
          ),
      ),
    )
  }, [isSelfCustodial, displayInfo, showSplashes])

  useEffect(() => {
    if (!isSelfCustodial) return
    return onSucceededPayment((payment, { claimSeenLive }) => {
      if (!isKnownPayment(payment)) return
      const tx = mapSelfCustodialTransaction(payment)
      if (!isSplashCandidate(tx)) return
      const detailsPending = !listed.current.some((listedTx) => listedTx.id === tx.id)
      const candidate = toCandidate(tx)
      /** A rejected payment never reaches the screen: the one already there keeps its
       *  refresh. */
      if (!showSplash({ ...candidate, detailsPending, claimSeenLive })) return
      offered.current = {
        id: tx.id,
        memo: tx.memo,
        detailsPending,
        unpriced: candidate.unpriced === true,
      }
    })
  }, [isSelfCustodial, toCandidate, showSplash])

  useEffect(() => {
    const last = offered.current
    if (!last) return
    const tx = allTransactions.find((candidate) => candidate.id === last.id)
    if (!tx) return
    const priceLoaded = last.unpriced && displayInfo !== undefined
    if (tx.memo === last.memo && !last.detailsPending && !priceLoaded) return
    offered.current = {
      id: tx.id,
      memo: tx.memo,
      detailsPending: false,
      unpriced: displayInfo === undefined,
    }
    refresh(toCandidate(tx))
  }, [allTransactions, displayInfo, toCandidate, refresh])

  return null
}
