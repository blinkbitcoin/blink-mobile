import { renderHook } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { useSendFailureCopy } from "@app/screens/send-bitcoin-screen/hooks/use-send-failure-copy"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const mockLogBreadcrumb = jest.fn()

jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  logBreadcrumb: (message: string) => mockLogBreadcrumb(message),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: jest.requireActual("@app/i18n/i18n-util").i18nObject("en"),
  }),
}))

loadLocale("en")
const LL = i18nObject("en")

const copyFor = (raw: string | undefined, options?: { mayHaveSent?: boolean }) => {
  const { result } = renderHook(() => useSendFailureCopy())
  return result.current(raw, options)
}

describe("useSendFailureCopy", () => {
  beforeEach(() => {
    mockLogBreadcrumb.mockClear()
  })

  it("sends the raw failure to the logs, not the screen", () => {
    const copy = copyFor("Route not found: payment server said no")

    expect(mockLogBreadcrumb).toHaveBeenCalledWith(
      "[send] failed: Route not found: payment server said no",
    )
    expect(copy).toBe(LL.SendBitcoinConfirmationScreen.somethingWentWrong())
  })

  it("names the cause of a self-custodial failure raised before the send", () => {
    expect(copyFor(SelfCustodialErrorCode.InsufficientFunds)).toBe(
      LL.SelfCustodialError.insufficientFunds(),
    )
    expect(copyFor(SelfCustodialErrorCode.BelowMinimum)).toBe(
      LL.SelfCustodialError.belowMinimum(),
    )
  })

  it("says something went wrong when no idempotency key could be made", () => {
    expect(copyFor(IDEMPOTENCY_KEY_UNAVAILABLE)).toBe(
      LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
    )
  })

  it("says a self-custodial failure that may have sent will still land or stay", () => {
    expect(copyFor(SelfCustodialErrorCode.NetworkError)).toBe(
      LL.SendBitcoinConfirmationScreen.paymentMayStillLand(),
    )
    expect(copyFor(SelfCustodialErrorCode.Generic)).toBe(
      LL.SendBitcoinConfirmationScreen.paymentMayStillLand(),
    )
  })

  it("keeps the copy of a self-custodial failure that says what became of the payment", () => {
    expect(copyFor(SelfCustodialErrorCode.OutcomeUnknown)).toBe(
      LL.SelfCustodialError.outcomeUnknown(),
    )
    expect(copyFor(SelfCustodialErrorCode.EarlierPaymentFound)).toBe(
      LL.SelfCustodialError.earlierPaymentFound(),
    )
  })

  it("says the money may still land for a send that threw, whatever its text", () => {
    expect(copyFor("socket hang up", { mayHaveSent: true })).toBe(
      LL.SendBitcoinConfirmationScreen.paymentMayStillLand(),
    )
  })

  it("never shows a custodial FAILURE's server text", () => {
    const serverText = "Insufficient balance for this transaction"

    expect(copyFor(serverText)).toBe(
      LL.SendBitcoinConfirmationScreen.somethingWentWrong(),
    )
  })

  it("says something went wrong when there is no reason at all", () => {
    expect(copyFor(undefined)).toBe(LL.SendBitcoinConfirmationScreen.somethingWentWrong())
  })
})
