import { act, renderHook } from "@testing-library/react-native"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import {
  HomeAuthedDocument,
  PaymentSendResult,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIntraLedgerConversion } from "@app/hooks/use-intra-ledger-conversion"
import { WalletDescriptor } from "@app/types/wallets"

type ConversionParams = {
  fromWallet: WalletDescriptor<WalletCurrency>
  toWallet: WalletDescriptor<WalletCurrency>
  fromAmount: number
}

const mockBtcSend = jest.fn()
const mockUsdSend = jest.fn()
const mockRecordError = jest.fn()
const mockLogAttempt = jest.fn()
const mockLogResult = jest.fn()
const mockLoadingState = { btc: false, usd: false }

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useIntraLedgerPaymentSendMutation: () => [
      mockBtcSend,
      { loading: mockLoadingState.btc },
    ],
    useIntraLedgerUsdPaymentSendMutation: () => [
      mockUsdSend,
      { loading: mockLoadingState.usd },
    ],
  }
})

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: { common: { error: () => "Something went wrong" } } }),
}))

jest.mock("@app/utils/analytics", () => ({
  logConversionAttempt: (...args: unknown[]) => mockLogAttempt(...args),
  logConversionResult: (...args: unknown[]) => mockLogResult(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError }),
}))

const btcToUsdParams: ConversionParams = {
  fromWallet: { id: "btc-wallet-id", currency: WalletCurrency.Btc },
  toWallet: { id: "usd-wallet-id", currency: WalletCurrency.Usd },
  fromAmount: 10000,
}

const usdToBtcParams: ConversionParams = {
  fromWallet: { id: "usd-wallet-id", currency: WalletCurrency.Usd },
  toWallet: { id: "btc-wallet-id", currency: WalletCurrency.Btc },
  fromAmount: 5000,
}

const runExecute = async (request: ConversionParams, onSuccess: jest.Mock) => {
  const { result } = renderHook(() => useIntraLedgerConversion({ onSuccess }))
  await act(async () => {
    await result.current.execute(request)
  })
  return result
}

describe("useIntraLedgerConversion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoadingState.btc = false
    mockLoadingState.usd = false
  })

  it("sends a BTC source through the BTC mutation and calls onSuccess", async () => {
    mockBtcSend.mockResolvedValue({
      data: { intraLedgerPaymentSend: { status: PaymentSendResult.Success, errors: [] } },
    })
    const onSuccess = jest.fn()

    const result = await runExecute(btcToUsdParams, onSuccess)

    expect(mockBtcSend).toHaveBeenCalledWith({
      variables: {
        input: {
          walletId: "btc-wallet-id",
          recipientWalletId: "usd-wallet-id",
          amount: 10000,
        },
      },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(mockUsdSend).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.errorMessage).toBeUndefined()
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      "notificationSuccess",
      {
        ignoreAndroidSystemSettings: true,
      },
    )
    expect(mockLogResult).toHaveBeenCalledWith({
      sendingWallet: WalletCurrency.Btc,
      receivingWallet: WalletCurrency.Usd,
      paymentStatus: PaymentSendResult.Success,
    })
  })

  it("sends a USD source through the USD mutation", async () => {
    mockUsdSend.mockResolvedValue({
      data: {
        intraLedgerUsdPaymentSend: { status: PaymentSendResult.Success, errors: [] },
      },
    })
    const onSuccess = jest.fn()

    await runExecute(usdToBtcParams, onSuccess)

    expect(mockUsdSend).toHaveBeenCalledWith({
      variables: {
        input: {
          walletId: "usd-wallet-id",
          recipientWalletId: "btc-wallet-id",
          amount: 5000,
        },
      },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(mockBtcSend).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("surfaces the application error message and does not call onSuccess on failure", async () => {
    mockBtcSend.mockResolvedValue({
      data: {
        intraLedgerPaymentSend: {
          status: PaymentSendResult.Failure,
          errors: [{ message: "Insufficient balance" }],
        },
      },
    })
    const onSuccess = jest.fn()

    const result = await runExecute(btcToUsdParams, onSuccess)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe("Insufficient balance")
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith("notificationError", {
      ignoreAndroidSystemSettings: true,
    })
  })

  it("translates top-level GraphQL errors through getErrorMessages", async () => {
    mockBtcSend.mockResolvedValue({
      data: { intraLedgerPaymentSend: { status: PaymentSendResult.Failure, errors: [] } },
      errors: [{ message: "Network error" }],
    })
    const onSuccess = jest.fn()

    const result = await runExecute(btcToUsdParams, onSuccess)

    expect(result.current.errorMessage).toBe("Network error")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("falls back to the localized error when the mutation returns no status", async () => {
    mockBtcSend.mockResolvedValue({ data: null })
    const onSuccess = jest.fn()

    const result = await runExecute(btcToUsdParams, onSuccess)

    expect(result.current.errorMessage).toBe("Something went wrong")
    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mockLogResult).not.toHaveBeenCalled()
  })

  it("records a thrown error to crashlytics and surfaces its message", async () => {
    mockBtcSend.mockRejectedValue(new Error("boom"))
    const onSuccess = jest.fn()

    const result = await runExecute(btcToUsdParams, onSuccess)

    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    expect(result.current.errorMessage).toBe("boom")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("exposes the mutation loading state", () => {
    mockLoadingState.usd = true

    const { result } = renderHook(() =>
      useIntraLedgerConversion({ onSuccess: jest.fn() }),
    )

    expect(result.current.loading).toBe(true)
  })
})
