import { TxNotificationType } from "@app/graphql/generated"

import { SplashCandidate, SplashPaymentType } from "./types"

type UpdateTransaction = SplashCandidate["transaction"]

const paymentHashOf = (transaction: UpdateTransaction): string | undefined => {
  const via = transaction.initiationVia
  if (via?.__typename === "InitiationViaLn") return via.paymentHash
  return undefined
}

/** LnUpdate PAID, IntraLedgerReceipt, and OnchainReceipt only. Pending on-chain and
 *  outgoing intraledger updates are not a splash. */
export const candidateFromUpdate = (update: {
  __typename?: string
  status?: string
  txNotificationType?: TxNotificationType
  transaction?: UpdateTransaction
}): SplashCandidate | null => {
  if (update.__typename === "LnUpdate" && update.transaction) {
    if (update.status !== "PAID") return null
    return {
      transaction: update.transaction,
      paymentType: SplashPaymentType.Lightning,
      paymentHash: paymentHashOf(update.transaction),
    }
  }
  if (
    update.__typename === "IntraLedgerUpdate" &&
    update.transaction &&
    update.txNotificationType === TxNotificationType.IntraLedgerReceipt
  ) {
    return {
      transaction: update.transaction,
      paymentType: SplashPaymentType.IntraLedger,
    }
  }
  if (
    update.__typename === "OnChainUpdate" &&
    update.transaction &&
    update.txNotificationType === TxNotificationType.OnchainReceipt
  ) {
    return {
      transaction: update.transaction,
      paymentType: SplashPaymentType.Onchain,
    }
  }
  return null
}
