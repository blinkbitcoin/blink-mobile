import React from "react"
import { Satoshis, type LnUrlPayServiceResponse } from "lnurl-pay"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { WalletCurrency } from "@app/graphql/generated"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import {
  ConvertMoneyAmount,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { Intraledger } from "../../app/screens/send-bitcoin-screen/send-bitcoin-details-screen.stories"
import { ContextForScreen } from "./helper"

const mockRequestInvoice = jest.fn()
jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestInvoice: (...args: unknown[]) => mockRequestInvoice(...args),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
}))

jest.mock("@react-native-firebase/app-check", () => {
  return () => ({
    initializeAppCheck: jest.fn(),
    getToken: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: jest.fn(),
    }),
  })
})

jest.mock("react-native-config", () => {
  return {
    APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
    APP_CHECK_IOS_DEBUG_TOKEN: "token",
  }
})

jest.mock("@gorhom/bottom-sheet")

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

it("SendScreen Details", async () => {
  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )
  await act(async () => {})
})

it("applies send amount only after modal dismiss animation completes", async () => {
  loadLocale("en")
  const LL = i18nObject("en")

  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )

  const nextButton = await screen.findByTestId(LL.common.next())
  expect(nextButton.props.accessibilityState?.disabled).toBe(true)

  await flushAsync()
  await flushAsync()

  fireEvent.press(screen.getByTestId("Amount Input Button"))
  await flushAsync()

  expect(screen.getByTestId("bottom-sheet-modal")).toBeTruthy()

  fireEvent.press(screen.getByTestId("Key 1"))
  await flushAsync()

  jest.useFakeTimers()
  try {
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])

    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )
    act(() => {
      jest.advanceTimersByTime(39)
    })
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )
    act(() => {
      jest.advanceTimersByTime(1)
    })
  } finally {
    jest.useRealTimers()
  }

  await waitFor(() => {
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })
})

describe("SendBitcoinDetailsScreen — LNURL requestInvoice gate", () => {
  const lnurlParams: LnUrlPayServiceResponse = {
    callback: "https://example.com/cb",
    fixed: false,
    min: 1 as Satoshis,
    max: 1000000 as Satoshis,
    domain: "example.com",
    metadata: [["text/plain", "Test"]],
    metadataHash: "",
    identifier: "alice@example.com",
    description: "Pay alice",
    image: "",
    commentAllowed: 0,
    rawData: { metadata: '[["text/plain","Test"]]' },
  }

  const convertMoneyAmount: ConvertMoneyAmount = (amount, currency) => ({
    amount: amount.amount,
    currency,
    currencyCode: currency,
  })

  const buildLnurlPaymentDetail = ({
    withSendMutation,
  }: {
    withSendMutation: boolean
  }): PaymentDetail<WalletCurrency> => {
    const sendingWalletDescriptor = {
      id: "btc-wallet-id",
      currency: WalletCurrency.Btc,
    } as const
    const unitOfAccountAmount = {
      amount: 5000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    } as const
    const settlementAmount = {
      amount: 5000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    } as const
    const detail = {
      paymentType: PaymentType.Lnurl,
      destination: "lnurl1abc",
      memo: "",
      convertMoneyAmount,
      setConvertMoneyAmount: () => detail,
      settlementAmount,
      settlementAmountIsEstimated: false,
      unitOfAccountAmount,
      sendingWalletDescriptor,
      setSendingWalletDescriptor: () => detail,
      lnurlParams,
      setInvoice: () => detail,
      successAction: undefined,
      setSuccessAction: () => detail,
      isMerchant: false,
      canSetAmount: true as const,
      setAmount: () => detail,
      canSetMemo: true as const,
      setMemo: () => detail,
      ...(withSendMutation
        ? {
            canSendPayment: true as const,
            canGetFee: true as const,
            getFee: jest.fn().mockResolvedValue({ amount: undefined }),
            sendPaymentMutation: jest.fn().mockResolvedValue({ status: "SUCCESS" }),
          }
        : { canSendPayment: false as const, canGetFee: false as const }),
    }
    return detail as unknown as PaymentDetail<WalletCurrency>
  }

  const buildRoute = (paymentDetail: PaymentDetail<WalletCurrency>) =>
    ({
      key: "sendBitcoinDetails",
      name: "sendBitcoinDetails",
      params: {
        paymentDestination: {
          valid: true,
          createPaymentDetail: () => paymentDetail,
        } as never,
      },
    }) as never

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("does NOT call lnurl-pay requestInvoice when paymentDetail.sendPaymentMutation is set (SC path)", async () => {
    const detail = buildLnurlPaymentDetail({ withSendMutation: true })
    const LL = i18nObject("en")

    render(
      <ContextForScreen>
        <SendBitcoinDetailsScreen route={buildRoute(detail)} />
      </ContextForScreen>,
    )

    await flushAsync()
    await flushAsync()

    fireEvent.press(screen.getByText(LL.common.next()))
    await flushAsync()

    expect(mockRequestInvoice).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ paymentDetail: expect.any(Object) }),
    )
  })

  it("calls lnurl-pay requestInvoice when paymentDetail.sendPaymentMutation is missing (custodial path)", async () => {
    const detail = buildLnurlPaymentDetail({ withSendMutation: false })
    const LL = i18nObject("en")
    mockRequestInvoice.mockResolvedValue({
      invoice: "lnbc10n1pjxample",
      successAction: undefined,
    })

    render(
      <ContextForScreen>
        <SendBitcoinDetailsScreen route={buildRoute(detail)} />
      </ContextForScreen>,
    )

    await flushAsync()
    await flushAsync()

    fireEvent.press(screen.getByText(LL.common.next()))
    await flushAsync()

    expect(mockRequestInvoice).toHaveBeenCalledTimes(1)
    expect(mockRequestInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ lnUrlOrAddress: "lnurl1abc" }),
    )
  })
})
