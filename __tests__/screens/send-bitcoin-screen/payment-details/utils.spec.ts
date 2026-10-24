import { WalletCurrency } from "@app/graphql/generated"
import {
  AmountInvalidReason,
  LimitType,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { isValidAmount } from "@app/screens/send-bitcoin-screen/payment-details/utils"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

const paymentDetailFor = (paymentType: PaymentType) =>
  ({
    paymentType,
    settlementAmount: toBtcMoneyAmount(1000),
    unitOfAccountAmount: toUsdMoneyAmount(100),
    convertMoneyAmount: () => toUsdMoneyAmount(100),
  }) as unknown as PaymentDetail<WalletCurrency>

const limit = (remainingLimit: number | null) => [
  {
    __typename: "OneDayAccountLimit" as const,
    totalLimit: 100000,
    remainingLimit,
    interval: 86400,
  },
]

const balances = {
  btcWalletAmount: toBtcMoneyAmount(100000),
  usdWalletAmount: toUsdMoneyAmount(100000),
}

describe("isValidAmount daily limit", () => {
  it("refuses any withdrawal once the remaining limit is 0", () => {
    expect(
      isValidAmount({
        ...balances,
        paymentDetail: paymentDetailFor(PaymentType.Lightning),
        withdrawalLimits: limit(0),
      }),
    ).toMatchObject({
      validAmount: false,
      invalidReason: AmountInvalidReason.InsufficientLimit,
      limitType: LimitType.Withdrawal,
    })
  })

  it("refuses any intraledger send once the remaining limit is 0", () => {
    expect(
      isValidAmount({
        ...balances,
        paymentDetail: paymentDetailFor(PaymentType.Intraledger),
        intraledgerLimits: limit(0),
      }),
    ).toMatchObject({
      validAmount: false,
      invalidReason: AmountInvalidReason.InsufficientLimit,
      limitType: LimitType.Intraledger,
    })
  })

  it("does not invent a limit the server did not report", () => {
    expect(
      isValidAmount({
        ...balances,
        paymentDetail: paymentDetailFor(PaymentType.Lightning),
        withdrawalLimits: limit(null),
      }),
    ).toEqual({ validAmount: true })
  })
})
