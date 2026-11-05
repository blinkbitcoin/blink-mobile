import { it } from "@jest/globals"

import { WalletCurrency } from "@app/graphql/generated"
import { decideSplash } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/decide-splash"
import { selfCustodialCandidate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/self-custodial-candidate"
import { toWalletMoneyAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

jest.mock("@react-native-firebase/crashlytics", () => ({
  getCrashlytics: jest.fn(),
  log: jest.fn(),
  recordError: jest.fn(),
}))

const NOW = 1_793_840_000_000
const A_MONTH_AGO = Math.floor(NOW / 1000) - 30 * 24 * 60 * 60

const receive = (paymentType: PaymentType, timestamp: number): NormalizedTransaction => ({
  id: `${paymentType}-${timestamp}`,
  amount: toWalletMoneyAmount(5_000, WalletCurrency.Btc),
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp,
  paymentType,
  sourceAccountType: AccountType.SelfCustodial,
})

const decide = (tx: NormalizedTransaction) =>
  decideSplash({
    candidate: selfCustodialCandidate(tx),
    foregroundSinceMs: NOW - 60_000,
    appActive: true,
    alreadySeen: false,
    enabled: true,
    minSats: 100,
    amountSats: 5_000,
    routeName: "Home",
    keyboardVisible: false,
    appLocked: false,
    overlayCovered: false,
  })

describe("selfCustodialCandidate", () => {
  it.each([PaymentType.Onchain, PaymentType.Lightning])(
    "drops a past %s receive that a wallet restore replays",
    (paymentType) => {
      expect(decide(receive(paymentType, A_MONTH_AGO))).toEqual({
        outcome: "skip",
        reason: "settled_before_foreground",
      })
    },
  )

  it("shows an on-chain deposit claimed now", () => {
    expect(decide(receive(PaymentType.Onchain, Math.floor(NOW / 1000))).outcome).toBe(
      "show",
    )
  })
})
