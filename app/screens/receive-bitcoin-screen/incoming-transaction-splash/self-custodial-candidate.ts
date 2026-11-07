import { type DepositInfo } from "@breeztech/breez-sdk-spark-react-native"

import { toTransactionFragment } from "@app/self-custodial/mappers/to-transaction-fragment"
import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

import { SplashCandidate, SplashPaymentType } from "./types"

type DisplayInfo = Parameters<typeof toTransactionFragment>[1]

/** A self-custodial payment's time is when it settled, so it is always checked against
 *  the moment the app came to the foreground. A wallet restore or sync replays every past
 *  payment as PaymentSucceeded; without the flag each old one would show the splash. */
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
  unpriced: !display,
})

/** A deposit has no time of its own until it is claimed: it counts from when the SDK
 *  reported it, which is now. Its id matches the unclaimed deposits list (txid:vout). */
export const selfCustodialDepositCandidate = (
  deposit: DepositInfo,
  nowMs: number,
  display?: DisplayInfo,
): SplashCandidate => ({
  transaction: toTransactionFragment(
    {
      id: `${deposit.txid}:${deposit.vout}`,
      amount: toBtcMoneyAmount(Number(deposit.amountSats)),
      direction: TransactionDirection.Receive,
      status: TransactionStatus.Pending,
      timestamp: Math.floor(nowMs / 1000),
      paymentType: PaymentType.Onchain,
      sourceAccountType: AccountType.SelfCustodial,
    },
    display,
  ),
  paymentType: SplashPaymentType.Onchain,
  createdAtIsSettlement: true,
  unclaimedDeposit: true,
  unpriced: !display,
})
