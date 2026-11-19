import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useReviewFeeText } from "@app/screens/send-bitcoin-screen/review/use-review-fee-text"
import { FeeType } from "@app/screens/send-bitcoin-screen/use-fee"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import {
  BtcMoneyAmount,
  DisplayCurrency,
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
} from "@app/types/amounts"

loadLocale("en")
const LL = i18nObject("en")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL }),
}))

jest.mock("@app/self-custodial/hooks", () => ({
  useTranslateSdkError: () => (code: string) => `translated ${code}`,
}))

const format = ({ moneyAmount }: { moneyAmount: MoneyAmount<WalletOrDisplayCurrency> }) =>
  `${moneyAmount.amount} ${moneyAmount.currency}`

/** The real hook's pairing: the secondary is whichever of display and wallet the primary
 *  isn't, and nothing when both are the same currency. */
const secondaryOf = ({
  primaryAmount,
  displayAmount,
  walletAmount,
}: {
  primaryAmount: MoneyAmount<WalletOrDisplayCurrency>
  displayAmount: MoneyAmount<WalletOrDisplayCurrency>
  walletAmount: MoneyAmount<WalletOrDisplayCurrency>
}) => {
  if (displayAmount.currencyCode === walletAmount.currencyCode) return undefined
  return primaryAmount.currency === DisplayCurrency ? walletAmount : displayAmount
}

jest.mock("@app/hooks", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: format,
    getSecondaryAmountIfCurrencyIsDifferent: secondaryOf,
    formatDisplayAndWalletAmount: (args: {
      primaryAmount?: MoneyAmount<WalletOrDisplayCurrency>
      displayAmount: MoneyAmount<WalletOrDisplayCurrency>
      walletAmount: MoneyAmount<WalletOrDisplayCurrency>
    }) => {
      const primaryAmount = args.primaryAmount ?? args.displayAmount
      const secondary = secondaryOf({ ...args, primaryAmount })
      return secondary
        ? `${format({ moneyAmount: primaryAmount })} (${format({ moneyAmount: secondary })})`
        : format({ moneyAmount: primaryAmount })
    },
  }),
}))

/** Distinct factors per currency, so each text shows which conversion it came from. */
const FACTOR: Record<string, number> = {
  [DisplayCurrency]: 10,
  [WalletCurrency.Usd]: 3,
  [WalletCurrency.Btc]: 1,
}
const convertMoneyAmount = <W extends WalletOrDisplayCurrency>(
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: W,
): MoneyAmount<W> => ({
  amount: moneyAmount.amount * FACTOR[toCurrency],
  currency: toCurrency,
  currencyCode: toCurrency === DisplayCurrency ? "EUR" : toCurrency,
})

const detailFor = (currency: WalletCurrency) =>
  ({
    convertMoneyAmount,
    sendingWalletDescriptor: { id: "wallet", currency },
  }) as unknown as PaymentDetail<WalletCurrency>

const fee11Sats = toBtcMoneyAmount(11)

/** A failed quote with the reason it carries, and the maximum fee when the probe had one. */
const failedFee = (message: string, amount?: BtcMoneyAmount): FeeType => ({
  status: "error",
  amount,
  errors: [{ __typename: "GraphQLApplicationError", message }],
})

const run = (
  fee: FeeType,
  {
    currency = WalletCurrency.Btc,
    leadsWithWalletCurrency = false,
  }: { currency?: WalletCurrency; leadsWithWalletCurrency?: boolean } = {},
) =>
  renderHook(() =>
    useReviewFeeText({
      fee,
      paymentDetail: detailFor(currency),
      leadsWithWalletCurrency,
    }),
  ).result.current

describe("useReviewFeeText", () => {
  const feeError = String(LL.common.feeError())

  it("writes every text as the fee error until a quote lands", () => {
    expect(run({ status: "loading" })).toEqual({
      feeDisplayText: feeError,
      currencyFeeAmount: feeError,
      satFeeAmount: feeError,
      feeErrorCode: undefined,
      feeErrorText: feeError,
    })
  })

  it("translates a self-custodial code and hands the code back", () => {
    const result = run(failedFee(SelfCustodialErrorCode.InsufficientFunds))

    expect(result.feeErrorCode).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(result.feeErrorText).toBe(
      `translated ${SelfCustodialErrorCode.InsufficientFunds}`,
    )
    expect(result.feeDisplayText).toBe(result.feeErrorText)
  })

  it("never shows custodial server text, only the generic fee error", () => {
    const result = run(failedFee("Unable to find a route for payment"))

    expect(result.feeErrorCode).toBe("Unable to find a route for payment")
    expect(result.feeErrorText).toBe(feeError)
  })

  it("leads the Fee row with the display currency, the wallet amount in brackets", () => {
    const result = run({ status: "set", amount: fee11Sats })

    expect(result.feeDisplayText).toBe(`110 ${DisplayCurrency} (11 BTC)`)
    expect(result.feeErrorCode).toBeUndefined()
  })

  it("leads the Fee row with the wallet unit when the sender typed in it", () => {
    const result = run(
      { status: "set", amount: fee11Sats },
      { leadsWithWalletCurrency: true },
    )

    expect(result.feeDisplayText).toBe(`11 BTC (110 ${DisplayCurrency})`)
  })

  it("brackets a Dollar wallet's fee in dollars, not sats", () => {
    const result = run(
      { status: "set", amount: fee11Sats },
      { currency: WalletCurrency.Usd },
    )

    expect(result.feeDisplayText).toBe(`110 ${DisplayCurrency} (33 USD)`)
  })

  it("keeps the receipt's fee in display currency and sats, whatever the row leads with", () => {
    const result = run(
      { status: "set", amount: fee11Sats },
      { currency: WalletCurrency.Usd, leadsWithWalletCurrency: true },
    )

    expect(result.currencyFeeAmount).toBe(`110 ${DisplayCurrency}`)
    expect(result.satFeeAmount).toBe("11 BTC")
  })

  it("writes a max fee from its amount and still hands back why the probe failed", () => {
    const result = run(failedFee("no route", fee11Sats))

    expect(result.feeDisplayText).toBe(`110 ${DisplayCurrency} (11 BTC)`)
    expect(result.feeErrorCode).toBe("no route")
  })
})
