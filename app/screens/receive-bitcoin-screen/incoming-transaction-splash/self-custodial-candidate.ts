import { toTransactionFragment } from "@app/self-custodial/mappers/to-transaction-fragment"
import { NormalizedTransaction, PaymentType } from "@app/types/transaction"

import { SplashCandidate, SplashPaymentType } from "./types"

type DisplayInfo = Parameters<typeof toTransactionFragment>[1]

/** A self-custodial payment's time is when it settled, so it is always checked against
 *  the moment the app came to the foreground, on-chain included. A wallet restore or sync
 *  replays every past payment as PaymentSucceeded; without the flag each old on-chain
 *  deposit would show the splash. */
export const selfCustodialCandidate = (
  tx: NormalizedTransaction,
  display?: DisplayInfo,
): SplashCandidate => ({
  transaction: toTransactionFragment(tx, display),
  paymentType:
    tx.paymentType === PaymentType.Onchain
      ? SplashPaymentType.Onchain
      : SplashPaymentType.Lightning,
  createdAtIsSettlement: true,
})
