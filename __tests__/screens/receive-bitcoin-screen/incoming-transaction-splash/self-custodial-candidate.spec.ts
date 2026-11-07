import { it } from "@jest/globals"

import { WalletCurrency } from "@app/graphql/generated"
import { decideSplash } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/decide-splash"
import {
  selfCustodialCandidate,
  selfCustodialDepositCandidate,
} from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/self-custodial-candidate"
import { SplashCandidate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/types"
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

const decide = (tx: NormalizedTransaction) => decideCandidate(selfCustodialCandidate(tx))

const decideCandidate = (candidate: SplashCandidate) =>
  decideSplash({
    candidate,
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

  it("shows a Lightning receive settled now", () => {
    expect(decide(receive(PaymentType.Lightning, Math.floor(NOW / 1000))).outcome).toBe(
      "show",
    )
  })
})

describe("selfCustodialDepositCandidate", () => {
  const deposit = {
    txid: "abc",
    vout: 1,
    amountSats: BigInt(5_000),
    isMature: false,
  } as Parameters<typeof selfCustodialDepositCandidate>[0]

  it("offers a detected deposit as a pending on-chain receive", () => {
    const candidate = selfCustodialDepositCandidate(deposit, NOW)

    expect(candidate).toMatchObject({
      paymentType: "onchain",
      unclaimedDeposit: true,
      transaction: {
        id: "abc:1",
        direction: "RECEIVE",
        status: "PENDING",
        settlementAmount: 5_000,
      },
    })
    expect(decideCandidate(candidate).outcome).toBe("show")
  })
})
