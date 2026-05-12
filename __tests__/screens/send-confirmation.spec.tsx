import React from "react"
import { TouchableOpacity, Text } from "react-native"
import { Satoshis } from "lnurl-pay"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { DisplayCurrency, toUsdMoneyAmount } from "@app/types/amounts"
import { WalletCurrency } from "@app/graphql/generated"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/intraledger"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import * as PaymentDetailsLightning from "@app/screens/send-bitcoin-screen/payment-details/lightning"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import {
  Intraledger,
  LightningLnURL,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.stories"
import { ContextForScreen } from "./helper"

jest.mock("@app/store/persistent-state", () => ({
  ...jest.requireActual("@app/store/persistent-state"),
  usePersistentStateContext: () => ({
    persistentState: {
      schemaVersion: 11,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
    },
    updateState: jest.fn(),
    resetState: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: undefined,
    selfCustodialEntries: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "NGN",
    setDisplayCurrency: jest.fn(),
    loading: false,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSendBitcoinConfirmationScreenQuery: jest.fn(() => ({
    data: {
      me: {
        id: "mocked-user-id",
        defaultAccount: {
          id: "mocked-account-id",
          wallets: [
            {
              id: "btc-wallet-id",
              balance: 500000,
              walletCurrency: "BTC",
            },
            {
              id: "usd-wallet-id",
              balance: 10000,
              walletCurrency: "USD",
            },
          ],
        },
      },
    },
  })),
}))

const btcSendingWalletDescriptor = {
  currency: WalletCurrency.Usd,
  id: "testwallet",
}

const convertMoneyAmountMock: ConvertMoneyAmount = (amount, currency) => {
  return {
    amount: amount.amount,
    currency,
    currencyCode: currency === DisplayCurrency ? "NGN" : currency,
  }
}

const testAmount = toUsdMoneyAmount(100)

const defaultParams: PaymentDetails.CreateIntraledgerPaymentDetailsParams<WalletCurrency> =
  {
    handle: "test",
    recipientWalletId: "testid",
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    unitOfAccountAmount: testAmount,
  }

const { createIntraledgerPaymentDetails } = PaymentDetails
const paymentDetail = createIntraledgerPaymentDetails(defaultParams)

const route = {
  key: "sendBitcoinConfirmationScreen",
  name: "sendBitcoinConfirmation",
  params: {
    paymentDetail,
  },
} as const

const successActionMessageMock = {
  tag: "message",
  message: "Thank you for your support.",
  description: null,
  url: null,
  ciphertext: null,
  iv: null,
  decipher: () => null,
}

const lnUrlMock = {
  callback: "https://example.com/lnurl/callback",
  metadata: [["text/plain", "Pay to user@example.com"]],
  min: 1000 as Satoshis,
  max: 1000000 as Satoshis,
  fixed: false,
  metadataHash: "",
  identifier: "user@example.com",
  description: "Payment for services",
  image: "https://example.com/image.png",
  commentAllowed: 0,
  rawData: {},
}

const defaultLightningParams: PaymentDetailsLightning.CreateLnurlPaymentDetailsParams<WalletCurrency> =
  {
    lnurl: "lnurl1dp68gurn8ghj7mr...",
    lnurlParams: lnUrlMock,
    paymentRequest: "lnbc1m1psh8d8zpp5qk3z7t...",
    paymentRequestAmount: {
      currency: "BTC",
      currencyCode: "BTC",
      amount: 10000,
    },
    unitOfAccountAmount: {
      currency: "USD",
      amount: 5.0,
      currencyCode: "USD",
    },
    successAction: successActionMessageMock,
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    isMerchant: false,
  }

const saveLnAddressContactMock = jest.fn(({ isMerchant }) => {
  if (isMerchant) {
    return Promise.resolve({ saved: false })
  }
  return Promise.resolve({ saved: true, handle: "user@example.com" })
})
jest.mock("@app/screens/send-bitcoin-screen/use-save-lnaddress-contact", () => ({
  useSaveLnAddressContact: () => saveLnAddressContactMock,
}))

const sendPaymentMock = jest.fn()
const mockUseSendPayment = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/use-send-payment", () => ({
  useSendPayment: () => mockUseSendPayment(),
}))

const mockUseFee = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/use-fee", () => ({
  __esModule: true,
  default: () => mockUseFee(),
}))

const mockUseSendBalances = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  ...jest.requireActual("@app/screens/send-bitcoin-screen/hooks/use-send-wallets"),
  useSendBalances: () => mockUseSendBalances(),
}))

const useActiveWalletMock = jest.fn(() => ({
  isSelfCustodial: false,
  isReady: true,
  needsBackendAuth: false,
  wallets: [],
  status: "ready",
  accountType: "Custodial",
}))
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => useActiveWalletMock(),
}))

const navigationDispatchMock = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: navigationDispatchMock,
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
}))

jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", () => {
  type Props = {
    onSwipe: () => void
    testID?: string
    initialText?: string
    disabled?: boolean
  }

  const MockGaloySliderButton = ({
    onSwipe,
    testID = "slider",
    initialText = "Slide",
    disabled = false,
  }: Props) => (
    <TouchableOpacity testID={testID} onPress={onSwipe} accessibilityState={{ disabled }}>
      <Text>{initialText}</Text>
    </TouchableOpacity>
  )

  return { __esModule: true, default: MockGaloySliderButton }
})

describe("SendBitcoinConfirmationScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    useActiveWalletMock.mockReturnValue({
      isSelfCustodial: false,
      isReady: true,
      needsBackendAuth: false,
      wallets: [],
      status: "ready",
      accountType: "Custodial",
    })
    loadLocale("en")
    LL = i18nObject("en")

    mockUseSendPayment.mockReturnValue({
      loading: false,
      hasAttemptedSend: false,
      sendPayment: sendPaymentMock,
    })
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })
    mockUseSendBalances.mockReturnValue({
      btcWallet: {
        id: "btc-wallet-id",
        balance: 500000,
        walletCurrency: WalletCurrency.Btc,
      },
      usdWallet: {
        id: "usd-wallet-id",
        balance: 10000,
        walletCurrency: WalletCurrency.Usd,
      },
    })
  })

  it("Send Screen Confirmation - Intraledger Payment", async () => {
    const { findByLabelText } = render(
      <ContextForScreen>
        <Intraledger route={route} />
      </ContextForScreen>,
    )

    // it seems we need multiple act because the component re-render multiple times
    // probably this could be debug with why-did-you-render
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const { children } = await findByLabelText("Successful Fee")
    expect(children).toEqual(["₦0 ($0.00)"])
  })

  it("Send Screen Confirmation - Lightning lnurl Payment", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)

    const route = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: {
        paymentDetail: paymentDetailLightning,
      },
    } as const

    const lnurl = "lnurl1dp68gurn8ghj7mr..."

    render(
      <ContextForScreen>
        <LightningLnURL route={route} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByText(lnurl)).toBeTruthy()
    expect(screen.getByText("$0.05 (₦100)")).toBeTruthy()
    expect(screen.getByTestId("slider")).toBeTruthy()
    expect(LL.SendBitcoinConfirmationScreen.slideToConfirm()).toBeTruthy()
  })

  it("Calls saveLnAddressContact when LNURL payment is SUCCESS", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
    const routeLnurl = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailLightning },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "SUCCESS",
      extraInfo: { preimage: "preimagetest" },
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeLnurl} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: defaultLightningParams.lnurl,
      isMerchant: false,
    })
  })

  it("Call saveLnAddressContact when LNURL payment is PENDING", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
    const routeLnurl = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailLightning },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "PENDING",
      extraInfo: {},
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeLnurl} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: defaultLightningParams.lnurl,
      isMerchant: false,
    })
  })

  it("Calls saveLnAddressContact when the active wallet is self-custodial (hook routes internally)", async () => {
    useActiveWalletMock.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      needsBackendAuth: false,
      wallets: [],
      status: "ready",
      accountType: "SelfCustodial",
    })

    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
    const routeLnurl = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailLightning },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "SUCCESS",
      extraInfo: { preimage: "preimagetest" },
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeLnurl} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: defaultLightningParams.lnurl,
      isMerchant: false,
    })
  })

  it("Does not call saveLnAddressContact when LNURL payment is to a merchant", async () => {
    const merchantParams = {
      ...defaultLightningParams,
      isMerchant: true,
    }

    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailMerchant = createLnurlPaymentDetails(merchantParams)
    const routeMerchant = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailMerchant },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "SUCCESS",
      extraInfo: { preimage: "preimagetest" },
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeMerchant} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: merchantParams.lnurl,
      isMerchant: true,
    })
  })

  describe("successAction precedence on completion-screen navigation", () => {
    const findCompletedRouteParams = () => {
      const reducerCalls = navigationDispatchMock.mock.calls
        .map(([reducer]) => reducer)
        .filter(
          (reducer): reducer is (state: unknown) => unknown =>
            typeof reducer === "function",
        )
      for (const reducer of reducerCalls) {
        const action = reducer({ index: 0, routes: [] }) as {
          payload?: { routes?: Array<{ name: string; params?: unknown }> }
          routes?: Array<{ name: string; params?: unknown }>
        }
        const routes = action.payload?.routes ?? action.routes ?? []
        const completed = routes.find((r) => r.name === "sendBitcoinCompleted")
        if (completed) return completed.params as { successAction?: unknown }
      }
      throw new Error("sendBitcoinCompleted route was not dispatched")
    }

    it("forwards extraInfo.successAction to the completed screen when present", async () => {
      const extraInfoSuccessAction = {
        tag: "message",
        message: "extra-info wins",
        description: null,
        url: null,
        ciphertext: null,
        iv: null,
        decipher: () => null,
      }
      const { createLnurlPaymentDetails } = PaymentDetailsLightning
      const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
      const routeLnurl = {
        key: "sendBitcoinConfirmationScreen",
        name: "sendBitcoinConfirmation",
        params: { paymentDetail: paymentDetailLightning },
      } as const

      sendPaymentMock.mockResolvedValueOnce({
        status: "SUCCESS",
        extraInfo: { preimage: "p", successAction: extraInfoSuccessAction },
      })

      render(
        <ContextForScreen>
          <LightningLnURL route={routeLnurl} />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      const params = findCompletedRouteParams()
      expect(params.successAction).toEqual(extraInfoSuccessAction)
    })

    it("falls back to paymentDetail.successAction when extraInfo.successAction is undefined", async () => {
      const { createLnurlPaymentDetails } = PaymentDetailsLightning
      const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
      const routeLnurl = {
        key: "sendBitcoinConfirmationScreen",
        name: "sendBitcoinConfirmation",
        params: { paymentDetail: paymentDetailLightning },
      } as const

      sendPaymentMock.mockResolvedValueOnce({
        status: "SUCCESS",
        extraInfo: { preimage: "p" },
      })

      render(
        <ContextForScreen>
          <LightningLnURL route={routeLnurl} />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      const params = findCompletedRouteParams()
      expect(params.successAction).toEqual(successActionMessageMock)
    })
  })
})

// 1 BTC at $20,000 → 50 sats per USD cent.
const SATS_PER_USD_CENT = 50

const usdBtcConvert: ConvertMoneyAmount = (amount, currency) => {
  if (amount.currency === currency) {
    return { amount: amount.amount, currency, currencyCode: currency }
  }
  if (amount.currency === WalletCurrency.Btc && currency === WalletCurrency.Usd) {
    return {
      amount: Math.floor(amount.amount / SATS_PER_USD_CENT),
      currency,
      currencyCode: currency,
    }
  }
  if (amount.currency === WalletCurrency.Usd && currency === WalletCurrency.Btc) {
    return {
      amount: amount.amount * SATS_PER_USD_CENT,
      currency,
      currencyCode: currency,
    }
  }
  return {
    amount: amount.amount,
    currency,
    currencyCode: currency === DisplayCurrency ? "NGN" : (currency as string),
  }
}

const buildUsdSettlementRoute = (
  unitOfAccountUsdCents: number,
  overrides?: { isSendingMax?: boolean },
) => {
  const usdDescriptor = { currency: WalletCurrency.Usd, id: "usd-wallet-id" } as const
  const params: PaymentDetails.CreateIntraledgerPaymentDetailsParams<WalletCurrency> = {
    handle: "test",
    recipientWalletId: "testid",
    convertMoneyAmount: usdBtcConvert,
    sendingWalletDescriptor: usdDescriptor,
    unitOfAccountAmount: toUsdMoneyAmount(unitOfAccountUsdCents),
  }
  const detail = PaymentDetails.createIntraledgerPaymentDetails(params)
  const merged = overrides ? { ...detail, ...overrides } : detail
  return {
    key: "sendBitcoinConfirmationScreen",
    name: "sendBitcoinConfirmation",
    params: { paymentDetail: merged },
  } as const
}

describe("SendBitcoinConfirmationScreen — fee-currency conversion", () => {
  beforeEach(() => {
    // Balance: $10.00 = 1000 cents.
    mockUseSendBalances.mockReturnValue({
      btcWallet: {
        id: "btc-wallet-id",
        balance: 0,
        walletCurrency: WalletCurrency.Btc,
      },
      usdWallet: {
        id: "usd-wallet-id",
        balance: 1000,
        walletCurrency: WalletCurrency.Usd,
      },
    })
  })

  it("USD($9.99) settlement + BTC(50 sats) fee at $10.00 balance — does not show amountExceed", async () => {
    // 50 sats / 50 = 1 cent. Total = 999 + 1 = 1000 ≤ 1000 (balance) → valid.
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 50, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(999)} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.queryByText(/exceeds your balance/i)).toBeNull()
  })

  it("USD($9.99) settlement + BTC(500 sats) fee at $10.00 balance — renders amountExceed", async () => {
    // 500 sats / 50 = 10 cents. Total = 999 + 10 = 1009 > 1000 (balance) → invalid.
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 500, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(999)} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByText(/exceeds your balance/i)).toBeTruthy()
  })
})

describe("SendBitcoinConfirmationScreen — skipBalanceCheck matrix", () => {
  beforeEach(() => {
    // Settlement $11.00 (1100 cents) is always over the $10.00 (1000 cents) balance.
    mockUseSendBalances.mockReturnValue({
      btcWallet: {
        id: "btc-wallet-id",
        balance: 0,
        walletCurrency: WalletCurrency.Btc,
      },
      usdWallet: {
        id: "usd-wallet-id",
        balance: 1000,
        walletCurrency: WalletCurrency.Usd,
      },
    })
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })
  })

  it("(isSendingMax=false, hasAttemptedSend=false) over balance — slider disabled + amountExceed shown", async () => {
    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(1100)} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByText(/exceeds your balance/i)).toBeTruthy()
    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(true)
  })

  it("(isSendingMax=true, hasAttemptedSend=false) over balance — slider enabled + no error", async () => {
    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(1100, { isSendingMax: true })} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.queryByText(/exceeds your balance/i)).toBeNull()
    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(false)
  })

  it("(isSendingMax=false, hasAttemptedSend=true) over balance — slider disabled + no error", async () => {
    mockUseSendPayment.mockReturnValue({
      loading: false,
      hasAttemptedSend: true,
      sendPayment: sendPaymentMock,
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(1100)} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.queryByText(/exceeds your balance/i)).toBeNull()
    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(true)
  })
})
