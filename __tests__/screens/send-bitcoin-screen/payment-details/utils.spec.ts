import { WalletCurrency } from "@app/graphql/generated"
import {
  createNoAmountLightningPaymentDetails,
  withConvertMoneyAmount,
} from "@app/screens/send-bitcoin-screen/payment-details"
import { createSelfCustodialLightningPaymentDetails } from "@app/self-custodial/payment-details/lightning"
import {
  DisplayCurrency,
  toBtcMoneyAmount,
  toDisplayAmount,
  toUsdMoneyAmount,
  type MoneyAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { SATS_DISPLAY_CURRENCY } from "@app/types/price"
import {
  createPriceConverters,
  priceOfCurrencyInCurrencyFromRates,
  satsOnlyPriceOfCurrencyInCurrency,
} from "@app/utils/price-conversion"

jest.mock("@app/utils/error-reporting", () => ({ recordAppError: jest.fn() }))

/** One BTC is 100,000 USD here, so a sat is a tenth of a US cent. */
const usdRates = priceOfCurrencyInCurrencyFromRates(0.1, 1)
if (!usdRates) throw new Error("the fixture rates must price")

const satsOnly = createPriceConverters(
  satsOnlyPriceOfCurrencyInCurrency,
  SATS_DISPLAY_CURRENCY,
).convertMoneyAmount
const inUsd = createPriceConverters(usdRates, "USD").convertMoneyAmount
const inUsdAtDoubleTheRate = createPriceConverters(
  priceOfCurrencyInCurrencyFromRates(0.2, 1) ?? usdRates,
  "USD",
).convertMoneyAmount

const btcWallet = { id: "btc-wallet", currency: WalletCurrency.Btc }
const usdWallet = { id: "usd-wallet", currency: WalletCurrency.Usd }

const noAmountInvoice = <T extends WalletCurrency>(
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>,
  convertMoneyAmount: typeof inUsd,
  sendingWalletDescriptor: { id: string; currency: T },
) =>
  createNoAmountLightningPaymentDetails({
    paymentRequest: "lnbc1noamount",
    unitOfAccountAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
  })

const typedInSats = (sats: number) =>
  toDisplayAmount({ amount: sats, currencyCode: SATS_DISPLAY_CURRENCY })

describe("withConvertMoneyAmount", () => {
  it("only re-prices an amount when the display currency stays the same", () => {
    const dollars = toDisplayAmount({ amount: 500, currencyCode: "USD" })
    const detail = noAmountInvoice(dollars, inUsd, btcWallet)

    const updated = withConvertMoneyAmount(detail, inUsdAtDoubleTheRate, "USD")

    expect(updated.unitOfAccountAmount).toEqual(dollars)
    expect(updated.settlementAmount.amount).toBe(2500)
  })

  describe("when a rate arrives after an amount was typed in sats", () => {
    it("keeps the amount and what it settles to", () => {
      const detail = noAmountInvoice(typedInSats(1000), satsOnly, btcWallet)

      const updated = withConvertMoneyAmount(detail, inUsd, "USD")

      expect(updated.unitOfAccountAmount).toEqual(toBtcMoneyAmount(1000))
      expect(updated.settlementAmount).toEqual(toBtcMoneyAmount(1000))
      expect(updated.convertMoneyAmount).toBe(inUsd)
    })

    it("leaves the payment sendable", () => {
      const detail = noAmountInvoice(typedInSats(1000), satsOnly, btcWallet)

      const updated = withConvertMoneyAmount(detail, inUsd, "USD")

      expect(updated.canSendPayment).toBe(true)
    })

    it("shows the carried amount in the new display currency", () => {
      const detail = noAmountInvoice(typedInSats(1000), satsOnly, btcWallet)

      const updated = withConvertMoneyAmount(detail, inUsd, "USD")

      expect(
        updated.convertMoneyAmount(updated.unitOfAccountAmount, DisplayCurrency),
      ).toEqual({ amount: 100, currency: DisplayCurrency, currencyCode: "USD" })
    })

    it("starts an empty entry over in the new display currency", () => {
      const detail = noAmountInvoice(typedInSats(0), satsOnly, btcWallet)

      const updated = withConvertMoneyAmount(detail, inUsd, "USD")

      expect(updated.unitOfAccountAmount).toEqual(
        toDisplayAmount({ amount: 0, currencyCode: "USD" }),
      )
    })

    it("builds a self-custodial detail around the carried amount instead of throwing", () => {
      const detail = createSelfCustodialLightningPaymentDetails({
        sdk: {} as never,
        paymentRequest: "lnbc1noamount",
        unitOfAccountAmount: typedInSats(1000),
        hasAmount: false,
        convertMoneyAmount: satsOnly,
        sendingWalletDescriptor: btcWallet,
      })

      const updated = withConvertMoneyAmount(detail, inUsd, "USD")

      expect(updated.settlementAmount).toEqual(toBtcMoneyAmount(1000))
      expect(updated.canSendPayment).toBe(true)
    })
  })

  describe("when the rate is lost after an amount was typed in fiat", () => {
    it("carries a bitcoin payment over in sats", () => {
      const dollars = toDisplayAmount({ amount: 100, currencyCode: "USD" })
      const detail = noAmountInvoice(dollars, inUsd, btcWallet)

      const updated = withConvertMoneyAmount(detail, satsOnly, SATS_DISPLAY_CURRENCY)

      expect(updated.settlementAmount).toEqual(toBtcMoneyAmount(1000))
      expect(
        updated.convertMoneyAmount(updated.unitOfAccountAmount, DisplayCurrency),
      ).toEqual({
        amount: 1000,
        currency: DisplayCurrency,
        currencyCode: SATS_DISPLAY_CURRENCY,
      })
    })

    it("clears a dollar payment that sats cannot price, rather than pricing it to nothing", () => {
      const dollars = toDisplayAmount({ amount: 500, currencyCode: "USD" })
      const detail = noAmountInvoice(dollars, inUsd, usdWallet)
      expect(detail.settlementAmount).toEqual(toUsdMoneyAmount(500))

      const updated = withConvertMoneyAmount(detail, satsOnly, SATS_DISPLAY_CURRENCY)

      expect(updated.unitOfAccountAmount).toEqual(typedInSats(0))
      expect(updated.canSendPayment).toBe(false)
    })
  })

  it("only swaps the converter of a detail whose amount the destination fixed", () => {
    const fixed = {
      ...noAmountInvoice(typedInSats(1000), satsOnly, btcWallet),
      canSetAmount: false as const,
      setAmount: undefined,
      setConvertMoneyAmount: jest.fn(),
    }

    withConvertMoneyAmount(fixed as never, inUsd, "USD")

    expect(fixed.setConvertMoneyAmount).toHaveBeenCalledWith(inUsd)
  })
})
