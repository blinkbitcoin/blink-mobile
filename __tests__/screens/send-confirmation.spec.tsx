import React from "react"
import { StyleSheet, TouchableOpacity, Text } from "react-native"
import { Satoshis } from "lnurl-pay"
import { act, fireEvent, render, screen, within } from "@testing-library/react-native"

import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment } from "@app/types/payment"
import { PreferredAmountCurrency } from "@app/graphql/client-only-query"
import { PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/intraledger"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import * as PaymentDetailsLightning from "@app/screens/send-bitcoin-screen/payment-details/lightning"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import SendBitcoinConfirmationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import * as colors from "@app/rne-theme/colors"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"
import { INFO_SECTION_OUTLINE_TEST_ID } from "@app/components/card-screen/info-section"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import {
  SEND_HERO_PRIMARY_TEST_ID,
  SEND_HERO_SECONDARY_TEST_ID,
} from "@app/screens/send-bitcoin-screen/send-hero"

import { flushEffects } from "../helpers/flush-effects"
import { ContextForScreen } from "./helper"

const Intraledger = ({
  route,
}: {
  route: RouteProp<RootStackParamList, "sendBitcoinConfirmation">
}) => <SendBitcoinConfirmationScreen route={route} />

const LightningLnURL = ({
  route,
}: {
  route: RouteProp<RootStackParamList, "sendBitcoinConfirmation">
}) => <SendBitcoinConfirmationScreen route={route} />

jest.mock("@app/store/persistent-state", () => ({
  ...jest.requireActual("@app/store/persistent-state"),
  usePersistentStateContext: () => ({
    persistentState: {
      schemaVersion: 12,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
    },
    updateState: jest.fn(),
    resetState: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  AccountRegistryProvider: ({ children }: { children: React.ReactNode }) => children,
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

/** The currency the sender last swapped the amount-entry keypad to; unset leads with the
 *  display currency. */
const mockPreferredAmountCurrency: { current?: string } = {}

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePreferredAmountCurrencyQuery: () => ({
    data: mockPreferredAmountCurrency.current
      ? { preferredAmountCurrency: mockPreferredAmountCurrency.current }
      : undefined,
  }),
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
// Spread the real module: the screen also imports IDEMPOTENCY_KEY_UNAVAILABLE from here,
// and a wholesale mock would make that constant undefined, silently disabling the
// comparison the error-mapping test exercises.
jest.mock("@app/screens/send-bitcoin-screen/use-send-payment", () => ({
  ...jest.requireActual("@app/screens/send-bitcoin-screen/use-send-payment"),
  useSendPayment: () => mockUseSendPayment(),
}))

const mockUseFee = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/use-fee", () => ({
  __esModule: true,
  default: () => mockUseFee(),
}))

const verifyPaymentSettledMock = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-verify-payment-settled", () => ({
  useVerifyPaymentSettled: () => verifyPaymentSettledMock,
}))

const mockUseSendBalances = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  ...jest.requireActual("@app/screens/send-bitcoin-screen/hooks/use-send-wallets"),
  useSendBalances: () => mockUseSendBalances(),
}))

const mockDefaultConversionLimits = {
  limits: { minFromAmount: 800, minToAmount: null },
  loading: false,
  error: null,
}
const mockUseNonCustodialConversionLimits = jest.fn()
jest.mock("@app/self-custodial/hooks/use-non-custodial-conversion-limits", () => ({
  useNonCustodialConversionLimits: () =>
    mockUseNonCustodialConversionLimits() ?? mockDefaultConversionLimits,
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
const navigationGoBackMock = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: navigationDispatchMock,
    navigate: jest.fn(),
    goBack: navigationGoBackMock,
    setOptions: jest.fn(),
  }),
}))

// The placeholder renders bare Views without a testID; stub it so the specs
// can query for it. hideAmount defaults to false, so the other specs in this
// file never render it.
jest.mock("@app/components/hidden-balance-placeholder/hidden-balance-placeholder", () => {
  const { View } = jest.requireActual("react-native")
  const MockHiddenBalancePlaceholder = () => <View testID="hidden-balance-placeholder" />
  return { HiddenBalancePlaceholder: MockHiddenBalancePlaceholder }
})

const copyToClipboardMock = jest.fn()
jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({ copyToClipboard: copyToClipboardMock }),
}))

const mockSliderProps = jest.fn()
jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", () => {
  type Props = {
    onSwipe: () => void
    testID?: string
    initialText?: string
    disabledText?: string
    disabled?: boolean
  }

  const MockGaloySliderButton = (props: Props) => {
    mockSliderProps(props)
    const {
      onSwipe,
      testID = "slider",
      initialText = "Slide",
      disabledText,
      disabled = false,
    } = props
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onSwipe}
        accessibilityState={{ disabled }}
      >
        <Text>{disabled ? disabledText ?? initialText : initialText}</Text>
      </TouchableOpacity>
    )
  }

  return { __esModule: true, default: MockGaloySliderButton }
})

const lastSliderProps = () => mockSliderProps.mock.calls.at(-1)?.[0]

const ERROR_SHEET_TEST_ID = "review-error-msg-bottom-sheet"

/** The error message sheet on review, or null while it is closed. */
const errorSheet = () => screen.queryByTestId(ERROR_SHEET_TEST_ID)

/** A failure shows twice while its sheet is open: inline under Details, and in the sheet
 *  on top of it (ruling 2026-09-17). */
const expectInlineAndInSheet = (text: string | RegExp) => {
  expect(screen.getAllByText(text)).toHaveLength(2)
  expect(within(screen.getByTestId(ERROR_SHEET_TEST_ID)).getByText(text)).toBeTruthy()
}

/** "Change amount" pops back to amount entry with a fresh `resetAmountAt`, never `goBack`. */
const expectChangeAmountDispatched = () => {
  expect(navigationDispatchMock).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "POP_TO",
      payload: expect.objectContaining({
        name: "sendBitcoinDetails",
        params: { resetAmountAt: expect.any(Number) },
      }),
    }),
  )
  expect(navigationGoBackMock).not.toHaveBeenCalled()
}

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
    expect(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID).props.children).toBe("₦100")
    expect(screen.getByTestId("slider")).toBeTruthy()
    expect(screen.getByText(LL.SendBitcoinConfirmationScreen.slideToSend())).toBeTruthy()
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
        if (completed)
          return completed.params as { successAction?: unknown; note?: unknown }
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

    it("forwards the payment memo as the note to the completed screen", async () => {
      const memo = "Dinner split with Alice"
      const { createLnurlPaymentDetails } = PaymentDetailsLightning
      const paymentDetailWithMemo = {
        ...createLnurlPaymentDetails(defaultLightningParams),
        memo,
      }
      const routeWithMemo = {
        key: "sendBitcoinConfirmationScreen",
        name: "sendBitcoinConfirmation",
        params: { paymentDetail: paymentDetailWithMemo },
      } as const

      sendPaymentMock.mockResolvedValueOnce({
        status: "SUCCESS",
        extraInfo: { preimage: "p" },
      })

      render(
        <ContextForScreen>
          <LightningLnURL route={routeWithMemo} />
        </ContextForScreen>,
      )

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      const params = findCompletedRouteParams()
      expect(params.note).toBe(memo)
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

const buildBtcSettlementRoute = (unitOfAccountSats: number) => {
  const btcDescriptor = { currency: WalletCurrency.Btc, id: "btc-wallet-id" } as const
  const params: PaymentDetails.CreateIntraledgerPaymentDetailsParams<WalletCurrency> = {
    handle: "test",
    recipientWalletId: "testid",
    convertMoneyAmount: usdBtcConvert,
    sendingWalletDescriptor: btcDescriptor,
    unitOfAccountAmount: toBtcMoneyAmount(unitOfAccountSats),
  }
  return {
    key: "sendBitcoinConfirmationScreen",
    name: "sendBitcoinConfirmation",
    params: { paymentDetail: PaymentDetails.createIntraledgerPaymentDetails(params) },
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

describe("SendBitcoinConfirmationScreen — USD remainder sweep warning", () => {
  const usdRemainderSweepMatcher = /will be converted to Bitcoin\. USD minimum:/i

  beforeEach(() => {
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

  it("renders the warning when fee quote reports IncreasedToAvoidDust and user is not draining balance", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust,
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByText(usdRemainderSweepMatcher)).toBeTruthy()
  })

  it("does NOT render the warning when there is no amountAdjustment in the fee quote", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.queryByText(usdRemainderSweepMatcher)).toBeNull()
  })

  it("does NOT render the warning when the user is already draining the full USD balance", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust,
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(1000)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.queryByText(usdRemainderSweepMatcher)).toBeNull()
  })

  it("does NOT render the warning for FlooredToMin (benign SDK floor)", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      amountAdjustment: ConvertAmountAdjustment.FlooredToMin,
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.queryByText(usdRemainderSweepMatcher)).toBeNull()
  })

  it("does NOT render the warning for a BTC source wallet even when the fee quote reports IncreasedToAvoidDust (false-positive guard)", async () => {
    mockUseSendBalances.mockReturnValue({
      btcWallet: {
        id: "btc-wallet-id",
        balance: 1_000_000,
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
      amount: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust,
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildBtcSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.queryByText(usdRemainderSweepMatcher)).toBeNull()
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

  it("(isSendingMax=false, hasAttemptedSend=true) over balance — no error, and a retry is still offered", async () => {
    // hasAttemptedSend is sticky: it suppresses the balance check because the backend may
    // already have debited the wallet. It no longer gates the slider — whether another
    // attempt is allowed is expressed solely by sendPayment, so an ambiguous failure can
    // be retried under the same idempotency key.
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
    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(false)
  })

  it("(hasAttemptedSend=true, sendPayment withheld) over balance — slider disabled + no error", async () => {
    // The hook withholds sendPayment while a send is in flight or terminally settled.
    mockUseSendPayment.mockReturnValue({
      loading: false,
      hasAttemptedSend: true,
      sendPayment: undefined,
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

  it("disables the slider when the fee quote errors so the user cannot sweep unwarned (C1)", async () => {
    mockUseFee.mockReturnValue({ status: "error" })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(true)
  })

  it("disables the slider while the fee quote is loading", async () => {
    mockUseFee.mockReturnValue({ status: "loading" })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(true)
  })

  it("keeps the slider enabled on a fee error that still carries an amount (max-fee fallback, #559)", async () => {
    mockUseSendPayment.mockReturnValue({
      loading: false,
      hasAttemptedSend: false,
      sendPayment: sendPaymentMock,
    })
    mockUseFee.mockReturnValue({
      status: "error",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })

    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(false)
  })
})

// A failed self-custodial quote used to render only the generic "Unable to calculate fee"
// with the slider disabled, naming no cause. The classified SDK code now picks the message.
describe("SendBitcoinConfirmationScreen — fee error messages", () => {
  const genericFeeError = /Unable to calculate fee/i
  const insufficientFunds = /Not enough funds to cover the amount and network fees/i

  const renderWithFee = async (fee: Record<string, unknown>) => {
    mockUseFee.mockReturnValue(fee)
    render(
      <ContextForScreen>
        <Intraledger route={buildUsdSettlementRoute(200)} />
      </ContextForScreen>,
    )
    await flushEffects()
  }

  it("names the cause when the quote carries a classified self-custodial code", async () => {
    await renderWithFee({
      status: "error",
      errors: [
        {
          __typename: "GraphQLApplicationError",
          message: SelfCustodialErrorCode.InsufficientFunds,
        },
      ],
    })

    expectInlineAndInSheet(insufficientFunds)
    expect(screen.queryByText(genericFeeError)).toBeNull()
  })

  it("translates the network-error code too", async () => {
    await renderWithFee({
      status: "error",
      errors: [
        {
          __typename: "GraphQLApplicationError",
          message: SelfCustodialErrorCode.NetworkError,
        },
      ],
    })

    expectInlineAndInSheet(/Network connection problem/i)
  })

  it("falls back to the generic string when the quote carries no code", async () => {
    await renderWithFee({ status: "error" })

    expect(screen.getByText(genericFeeError)).toBeTruthy()
  })

  // Custodial errors are raw GraphQL text, not something to put in front of a user, and
  // useTranslateSdkError passes unknown input straight through — hence the code guard.
  it("keeps the generic string for a custodial GraphQL error message", async () => {
    await renderWithFee({
      status: "error",
      errors: [
        {
          __typename: "GraphQLApplicationError",
          message: "Unbalanced transaction: ledger entry rejected",
        },
      ],
    })

    expect(screen.getByText(genericFeeError)).toBeTruthy()
    expect(screen.queryByText(/Unbalanced transaction/i)).toBeNull()
  })

  it("shows no fee error at all once the quote succeeds", async () => {
    await renderWithFee({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })

    expect(screen.queryByText(genericFeeError)).toBeNull()
    expect(screen.queryByText(insufficientFunds)).toBeNull()
  })
})

describe("SendBitcoinConfirmationScreen — 409 idempotency conflict recovery", () => {
  const conflictError = Object.assign(
    new Error("HTTP fetch failed from 'galoy': 409: Conflict"),
    { statusCode: 409 },
  )

  const buildLnurlRoute = () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    return {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: createLnurlPaymentDetails(defaultLightningParams) },
    } as const
  }

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
      if (completed) return completed.params as { status?: unknown; createdAt?: unknown }
    }
    throw new Error("sendBitcoinCompleted route was not dispatched")
  }

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
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

  it("navigates to the completed screen when the ledger confirms the payment settled", async () => {
    sendPaymentMock.mockRejectedValueOnce(conflictError)
    verifyPaymentSettledMock.mockResolvedValueOnce({
      status: "SUCCESS",
      createdAt: 1700000000,
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(verifyPaymentSettledMock).toHaveBeenCalledWith({
      walletId: btcSendingWalletDescriptor.id,
      paymentRequest: defaultLightningParams.paymentRequest,
    })
    const params = findCompletedRouteParams()
    expect(params.status).toBe("SUCCESS")
    expect(params.createdAt).toBe(1700000000)
    expect(screen.queryByText(/Payment already attempted/i)).toBeNull()
  })

  it("keeps the slider busy while the 409 is verified, with no sheet or error (S6)", async () => {
    let settleVerify: (value: undefined) => void = () => {}
    sendPaymentMock.mockRejectedValueOnce(conflictError)
    verifyPaymentSettledMock.mockReturnValueOnce(
      new Promise((resolve) => {
        settleVerify = resolve
      }),
    )

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(verifyPaymentSettledMock).toHaveBeenCalledTimes(1)
    expect(mockSliderProps.mock.calls.at(-1)?.[0].isLoading).toBe(true)
    expect(screen.queryByText(/Payment already attempted/i)).toBeNull()

    await act(async () => settleVerify(undefined))

    expect(mockSliderProps.mock.calls.at(-1)?.[0].isLoading).toBe(false)
  })

  it("falls back to the already-attempted message when settlement cannot be confirmed", async () => {
    sendPaymentMock.mockRejectedValueOnce(conflictError)
    verifyPaymentSettledMock.mockResolvedValueOnce(undefined)

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(verifyPaymentSettledMock).toHaveBeenCalledTimes(1)
    expectInlineAndInSheet(/Payment already attempted/i)
    expect(navigationDispatchMock).not.toHaveBeenCalled()
  })

  it("does not attempt verification for an intraledger payment", async () => {
    sendPaymentMock.mockRejectedValueOnce(conflictError)

    render(
      <ContextForScreen>
        <Intraledger route={route} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(verifyPaymentSettledMock).not.toHaveBeenCalled()
    expectInlineAndInSheet(/Payment already attempted/i)
    expect(navigationDispatchMock).not.toHaveBeenCalled()
  })

  it("still surfaces non-conflict errors unchanged", async () => {
    sendPaymentMock.mockRejectedValueOnce(new Error("insufficient balance"))

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(verifyPaymentSettledMock).not.toHaveBeenCalled()
    expectInlineAndInSheet("insufficient balance")
  })

  it("shows a generic error when the CSPRNG cannot mint an idempotency key", async () => {
    // The hook rejects with a sentinel rather than a raw Nitro string; the screen must
    // translate it instead of showing the user "idempotency-key-unavailable".
    sendPaymentMock.mockRejectedValueOnce(new Error(IDEMPOTENCY_KEY_UNAVAILABLE))

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(screen.queryByText(IDEMPOTENCY_KEY_UNAVAILABLE)).toBeNull()
    expect(verifyPaymentSettledMock).not.toHaveBeenCalled()
  })

  it("keeps the slider armed after an ambiguous throw, so the user can retry", async () => {
    // A non-409 throw is the ambiguous case: the request may have landed. The hook
    // reopens sendPayment under the same key (pinned in the hook spec); the screen's half
    // of the contract is that the slider is gated by sendPayment alone, never by
    // hasAttemptedSend, so a second swipe actually fires.
    sendPaymentMock
      .mockRejectedValueOnce(new Error("network died"))
      .mockResolvedValueOnce({ status: "SUCCESS", extraInfo: {} })

    render(
      <ContextForScreen>
        <LightningLnURL route={buildLnurlRoute()} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expectInlineAndInSheet("network died")
    expect(verifyPaymentSettledMock).not.toHaveBeenCalled()
    expect(screen.getByTestId("slider").props.accessibilityState.disabled).toBe(false)

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(2)
  })
})

// The confirmation screen is a resting screen, not a picker: nothing on it
// has to be compared against a balance, so hide-balance applies here the way
// it does on the home screen. The amount being authorised stays readable.
describe("hide balance", () => {
  const renderWithHideAmount = (hideAmount: boolean) =>
    render(
      <ContextForScreen>
        <HideAmountContextProvider value={{ hideAmount, toggleHideAmount: jest.fn() }}>
          <Intraledger route={route} />
        </HideAmountContextProvider>
      </ContextForScreen>,
    )

  it("masks the From balance while hide-balance is on", async () => {
    renderWithHideAmount(true)
    await flushEffects()

    // Exactly one placeholder: the From block. A second would mean the
    // amount or fee field had been masked too, which is not the intent.
    expect(screen.queryAllByTestId("hidden-balance-placeholder")).toHaveLength(1)
  })

  it("leaves the amount being sent readable while hide-balance is on", async () => {
    renderWithHideAmount(true)
    await flushEffects()

    const { children } = await screen.findByLabelText("Successful Fee")
    expect(children).toEqual(["₦0 ($0.00)"])
  })

  it("shows the From balance when balances are visible", async () => {
    renderWithHideAmount(false)
    await flushEffects()

    expect(screen.queryAllByTestId("hidden-balance-placeholder")).toHaveLength(0)
  })
})

describe("SendBitcoinConfirmationScreen — slide to send", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue(undefined)
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

  const renderRoute = async (
    paymentRoute: ReturnType<
      typeof buildUsdSettlementRoute | typeof buildBtcSettlementRoute
    >,
  ) => {
    render(
      <ContextForScreen>
        <Intraledger route={paymentRoute} />
      </ContextForScreen>,
    )
    await flushEffects()
  }

  it("reads 'Slide to send' once the fee has resolved", async () => {
    await renderRoute(buildUsdSettlementRoute(200))

    expect(screen.getByText(LL.SendBitcoinConfirmationScreen.slideToSend())).toBeTruthy()
    expect(lastSliderProps().disabled).toBe(false)
  })

  it("reads 'Calculating fee…' while the fee quote is loading", async () => {
    mockUseFee.mockReturnValue({ status: "loading" })

    await renderRoute(buildUsdSettlementRoute(200))

    expect(
      screen.getByText(LL.SendBitcoinConfirmationScreen.calculatingFee()),
    ).toBeTruthy()
    expect(lastSliderProps().disabled).toBe(true)
  })

  it("reads 'Calculating fee…' when the fee quote failed without an amount", async () => {
    mockUseFee.mockReturnValue({ status: "error" })

    await renderRoute(buildUsdSettlementRoute(200))

    expect(
      screen.getByText(LL.SendBitcoinConfirmationScreen.calculatingFee()),
    ).toBeTruthy()
  })

  it("reads 'Calculating fee…' while the dust check is pending", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust,
    })
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: true,
      error: null,
    })

    await renderRoute(buildUsdSettlementRoute(200))

    expect(
      screen.getByText(LL.SendBitcoinConfirmationScreen.calculatingFee()),
    ).toBeTruthy()
    expect(lastSliderProps().disabled).toBe(true)
  })

  it("stays disabled without claiming to calculate when the dust check is blocked (N1 deferred)", async () => {
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust,
    })
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: false,
      error: new Error("limits failed"),
    })

    await renderRoute(buildUsdSettlementRoute(200))

    expect(lastSliderProps().disabled).toBe(true)
    expect(lastSliderProps().disabledText).toBeUndefined()
    expect(screen.getByText(LL.SendBitcoinConfirmationScreen.slideToSend())).toBeTruthy()
  })

  it("does not claim to calculate when the amount is over balance", async () => {
    await renderRoute(buildUsdSettlementRoute(11000))

    expect(lastSliderProps().disabled).toBe(true)
    expect(
      screen.queryByText(LL.SendBitcoinConfirmationScreen.calculatingFee()),
    ).toBeNull()
  })

  it("uses the Dollar accent for a Dollar send", async () => {
    await renderRoute(buildUsdSettlementRoute(200))

    expect(lastSliderProps().accentColor).toBe(colors.dark._green)
  })

  it("uses the primary accent for a Bitcoin send", async () => {
    await renderRoute(buildBtcSettlementRoute(1000))

    expect([colors.light.primary, colors.dark.primary]).toContain(
      lastSliderProps().accentColor,
    )
  })

  it("rotates the send progress labels in the ticket's order", async () => {
    await renderRoute(buildUsdSettlementRoute(200))

    const progress = LL.SendBitcoinConfirmationScreen.sendProgress
    expect(lastSliderProps().busyLabels).toEqual([
      progress.reviewing(),
      progress.signing(),
      progress.findingRoute(),
      progress.broadcasting(),
      progress.checkingDelivery(),
      progress.retrying(),
      progress.almostThere(),
      progress.anyTimeNow(),
      progress.ohOh(),
      progress.tryingAgain(),
    ])
  })
})

describe("SendBitcoinConfirmationScreen — review layout", () => {
  let LL: ReturnType<typeof i18nObject>

  const btcBalance = (balance: number) =>
    mockUseSendBalances.mockReturnValue({
      btcWallet: { id: "btc-wallet-id", balance, walletCurrency: WalletCurrency.Btc },
      usdWallet: {
        id: "usd-wallet-id",
        balance: 10000,
        walletCurrency: WalletCurrency.Usd,
      },
    })

  const btcFee = (amount: number) =>
    mockUseFee.mockReturnValue({
      status: "set",
      amount: { amount, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    })

  /** An on-chain send built on the intraledger detail: review only reads these fields. */
  const buildOnchainRoute = (
    sats: number,
    extra: { payoutSpeed?: PayoutSpeed; feeTier?: FeeTierOption } = {},
  ) => {
    const base = buildBtcSettlementRoute(sats)
    return {
      ...base,
      params: {
        paymentDetail: {
          ...base.params.paymentDetail,
          paymentType: "onchain",
          destination: "bc1q6pwejxkd0gfr2m7fvs4yh3nh5ul7zc8smg9fq4aw",
          ...extra,
        },
      },
    } as unknown as ReturnType<typeof buildBtcSettlementRoute>
  }

  const renderReview = async (
    paymentRoute: ReturnType<typeof buildBtcSettlementRoute>,
    hideAmount = false,
    toggleHideAmount = jest.fn(),
  ) => {
    render(
      <ContextForScreen>
        <HideAmountContextProvider value={{ hideAmount, toggleHideAmount }}>
          <Intraledger route={paymentRoute} />
        </HideAmountContextProvider>
      </ContextForScreen>,
    )
    await flushEffects()
  }

  const outlineColor = () => {
    const outline = screen.queryByTestId(INFO_SECTION_OUTLINE_TEST_ID)
    return outline ? StyleSheet.flatten(outline.props.style).borderColor : undefined
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue(undefined)
    loadLocale("en")
    LL = i18nObject("en")
    mockUseSendPayment.mockReturnValue({
      loading: false,
      hasAttemptedSend: false,
      sendPayment: sendPaymentMock,
    })
    btcBalance(500000)
    btcFee(0)
  })

  describe("sections", () => {
    it("renders the hero, Destination, From Balance and Details in that order", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      const json = JSON.stringify(screen.toJSON())
      const positions = [
        LL.SendBitcoinConfirmationScreen.sending(),
        `${LL.SendBitcoinScreen.destination()}`,
        LL.SendBitcoinConfirmationScreen.fromBalance(),
        LL.SendBitcoinConfirmationScreen.details(),
        // The destination label carries its payment type ("Destination - Intraledger"), so
        // each section is found by the start of its string rather than the whole of it.
      ].map((text) => json.indexOf(`"${text}`))

      expect(positions.every((position) => position >= 0)).toBe(true)
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    })

    it("shows the same amounts in the hero that it hands to the completed screen", async () => {
      sendPaymentMock.mockResolvedValueOnce({ status: "SUCCESS" })
      await renderReview(buildBtcSettlementRoute(1000))

      const primary = screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID).props.children
      const secondary = screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID).props.children

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      const reducer = navigationDispatchMock.mock.calls
        .map(([action]) => action)
        .find((action) => typeof action === "function")
      const reset = reducer({ index: 0, routes: [] }) as {
        payload: { routes: { name: string; params: Record<string, unknown> }[] }
      }
      const completed = reset.payload.routes.find(
        (entry) => entry.name === "sendBitcoinCompleted",
      )
      expect(completed?.params.currencyAmount).toBe(primary)
      expect(completed?.params.satAmount).toBe(secondary)
    })

    it("copies the destination when the Destination field is pressed", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      fireEvent.press(screen.getByTestId("send-review-copy-destination"))

      expect(copyToClipboardMock).toHaveBeenCalledWith(
        expect.objectContaining({ content: "test" }),
      )
    })

    it("paints the Details card on the static grey7 surface", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      const feeLabel = screen.getByText(LL.SendBitcoinConfirmationScreen.feeLabel())
      let node = feeLabel.parent
      let background: string | undefined
      while (node && !background) {
        background = StyleSheet.flatten(node.props.style)?.backgroundColor
        node = node.parent
      }
      expect(background).toBe(colors.light.grey7)
    })
  })

  describe("Details rows", () => {
    it("shows a spinner in the Fee row while the fee loads", async () => {
      mockUseFee.mockReturnValue({ status: "loading" })
      await renderReview(buildBtcSettlementRoute(1000))

      expect(
        screen.getByLabelText(`${LL.SendBitcoinConfirmationScreen.feeLabel()} loading`),
      ).toBeTruthy()
      expect(screen.queryByLabelText("Successful Fee")).toBeNull()
    })

    it("shows the fee error under the card, not in the Fee row, and outlines the card red when the quote fails", async () => {
      mockUseFee.mockReturnValue({ status: "error" })
      await renderReview(buildBtcSettlementRoute(1000))

      const json = JSON.stringify(screen.toJSON())
      expect(json.indexOf(`"${LL.common.feeError()}"`)).toBeGreaterThan(
        json.indexOf(`"${LL.SendBitcoinConfirmationScreen.feeLabel()}"`),
      )
      expect(screen.getByText("—")).toBeTruthy()
      expect(outlineColor()).toBe(colors.light.error)
    })

    it("marks a maximum fee with * and explains it under the card, in grey", async () => {
      mockUseFee.mockReturnValue({
        status: "error",
        amount: { amount: 10, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      })
      await renderReview(buildBtcSettlementRoute(1000))

      expect(screen.getByText(/ \*$/)).toBeTruthy()
      const footnote = screen.getByText(
        `*${LL.SendBitcoinConfirmationScreen.maxFeeSelected()}`,
      )
      expect(StyleSheet.flatten(footnote.props.style).color).toBe(colors.light.grey2)
      expect(outlineColor()).toBeUndefined()
    })

    it("adds a Note row only when the payment carries a note", async () => {
      const base = buildBtcSettlementRoute(1000)
      await renderReview({
        ...base,
        params: { paymentDetail: { ...base.params.paymentDetail, memo: "Dinner" } },
      })

      expect(screen.getByText(LL.common.note())).toBeTruthy()
      expect(screen.getByText("Dinner")).toBeTruthy()
    })

    it("has no Note row without a note", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      expect(screen.queryByText(LL.common.note())).toBeNull()
    })

    it("shows the custodial payout speed as the Transaction priority on-chain", async () => {
      await renderReview(buildOnchainRoute(1000, { payoutSpeed: PayoutSpeed.Slow }))

      expect(screen.getByText(LL.SendBitcoinScreen.feeTier())).toBeTruthy()
      expect(screen.getByText(`${LL.SendBitcoinScreen.slow()} ~ 24h`)).toBeTruthy()
    })

    it("shows the self-custodial fee tier as the Transaction priority on-chain", async () => {
      await renderReview(buildOnchainRoute(1000, { feeTier: FeeTierOption.Medium }))

      expect(screen.getByText(`${LL.SendBitcoinScreen.medium()} ~ 30m`)).toBeTruthy()
    })

    it("has no Transaction priority row off-chain", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      expect(screen.queryByText(LL.SendBitcoinScreen.feeTier())).toBeNull()
    })
  })

  describe("notices under Details", () => {
    it("outlines the card red, explains the shortfall and offers Change amount when the total exceeds the balance", async () => {
      btcBalance(1050)
      btcFee(100)
      await renderReview(buildBtcSettlementRoute(1000))

      expect(outlineColor()).toBe(colors.light.error)
      expect(screen.getByText(/Total exceeds your balance/)).toBeTruthy()
      expect(lastSliderProps().disabled).toBe(true)

      fireEvent.press(screen.getByText(LL.SendBitcoinConfirmationScreen.changeAmount()))
      expectChangeAmountDispatched()
    })

    it("outlines the card in the warning colour and wraps the high-fee advice on-chain", async () => {
      btcFee(100)
      await renderReview(buildOnchainRoute(1000, { payoutSpeed: PayoutSpeed.Fast }))

      expect(outlineColor()).toBe(colors.light.warning)
      const advice = screen.getByText(
        LL.SendBitcoinConfirmationScreen.lightningRecommended(),
      )
      expect(advice.props.numberOfLines).toBeUndefined()
      expect(lastSliderProps().disabled).toBe(false)
    })

    it("lets the blocking low-funds error win over the high-fee advice", async () => {
      btcBalance(1050)
      btcFee(100)
      await renderReview(buildOnchainRoute(1000, { payoutSpeed: PayoutSpeed.Fast }))

      expect(outlineColor()).toBe(colors.light.error)
      expect(screen.getByText(/Total exceeds your balance/)).toBeTruthy()
      expect(
        screen.queryByText(LL.SendBitcoinConfirmationScreen.lightningRecommended()),
      ).toBeNull()
    })

    it("shows a send failure under the card without outlining it or offering Change amount", async () => {
      sendPaymentMock.mockRejectedValueOnce(new Error("route not found"))
      await renderReview(buildBtcSettlementRoute(1000))

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      expectInlineAndInSheet("route not found")
      expect(outlineColor()).toBeUndefined()
      expect(
        screen.queryByText(LL.SendBitcoinConfirmationScreen.changeAmount()),
      ).toBeNull()
    })

    it("offers Change amount when the fee quote fails because the amount is below the minimum", async () => {
      mockUseFee.mockReturnValue({
        status: "error",
        errors: [
          {
            __typename: "GraphQLApplicationError",
            message: SelfCustodialErrorCode.BelowMinimum,
          },
        ],
      })
      await renderReview(buildBtcSettlementRoute(1000))

      expectInlineAndInSheet(LL.SelfCustodialError.belowMinimum())
      // The inline link and the sheet's button are the same action.
      const [inlineLink] = screen.getAllByText(
        LL.SendBitcoinConfirmationScreen.changeAmount(),
      )
      fireEvent.press(inlineLink)
      expectChangeAmountDispatched()
    })

    it("does not offer Change amount when the fee quote fails on the network", async () => {
      mockUseFee.mockReturnValue({
        status: "error",
        errors: [
          {
            __typename: "GraphQLApplicationError",
            message: SelfCustodialErrorCode.NetworkError,
          },
        ],
      })
      await renderReview(buildBtcSettlementRoute(1000))

      expectInlineAndInSheet(LL.SelfCustodialError.networkError())
      expect(
        screen.queryByText(LL.SendBitcoinConfirmationScreen.changeAmount()),
      ).toBeNull()
    })

    it("offers Change amount when the send fails over the 24 hour limit", async () => {
      sendPaymentMock.mockResolvedValueOnce({
        status: "FAILURE",
        errorsMessage: "Cannot transfer more than $1000.00 in 24 hours",
      })
      await renderReview(buildBtcSettlementRoute(1000))

      await act(async () => {
        fireEvent.press(screen.getByTestId("slider"))
      })

      expectInlineAndInSheet(/Cannot transfer more than/)
      const [inlineLink] = screen.getAllByText(
        LL.SendBitcoinConfirmationScreen.changeAmount(),
      )
      fireEvent.press(inlineLink)
      expectChangeAmountDispatched()
    })
  })

  describe("amount currency", () => {
    const heroLines = () => [
      screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID).props.children,
      screen.queryByTestId(SEND_HERO_SECONDARY_TEST_ID)?.props.children,
    ]
    const feeRow = () =>
      [screen.getByLabelText("Successful Fee").props.children].flat().join("")

    afterEach(() => {
      mockPreferredAmountCurrency.current = undefined
    })

    it("leads the hero and Fee row with the display currency by default", async () => {
      btcFee(50)
      await renderReview(buildBtcSettlementRoute(1000))

      expect(heroLines()).toEqual(["₦10", "1,000 SAT"])
      expect(feeRow()).toBe("₦1 (50 SAT)")
    })

    it("leads the hero and Fee row with sats when the sender typed in sats", async () => {
      mockPreferredAmountCurrency.current = PreferredAmountCurrency.Default
      btcFee(50)
      await renderReview(buildBtcSettlementRoute(1000))

      expect(heroLines()).toEqual(["1,000 SAT", "₦10"])
      expect(feeRow()).toBe("50 SAT (₦1)")
    })

    it("pairs the display currency with dollars, not sats, for a dollar wallet", async () => {
      mockUseSendBalances.mockReturnValue({
        btcWallet: {
          id: "btc-wallet-id",
          balance: 0,
          walletCurrency: WalletCurrency.Btc,
        },
        usdWallet: {
          id: "usd-wallet-id",
          balance: 10000,
          walletCurrency: WalletCurrency.Usd,
        },
      })
      mockPreferredAmountCurrency.current = PreferredAmountCurrency.Default
      btcFee(50)
      await renderReview(buildUsdSettlementRoute(999))

      expect(heroLines()).toEqual(["$9.99", "₦10"])
      expect(feeRow()).toBe("$0.01 (₦1)")
    })

    it("leads a fixed amount with the display currency whatever the sender last typed in", async () => {
      mockPreferredAmountCurrency.current = PreferredAmountCurrency.Default
      btcFee(50)
      const base = buildBtcSettlementRoute(1000)
      await renderReview({
        ...base,
        params: {
          paymentDetail: { ...base.params.paymentDetail, canSetAmount: false },
        },
      } as unknown as ReturnType<typeof buildBtcSettlementRoute>)

      expect(heroLines()).toEqual(["₦10", "1,000 SAT"])
      expect(feeRow()).toBe("₦1 (50 SAT)")
    })
  })

  describe("hidden balance", () => {
    it("reveals the From Balance on a tap without touching the hide-balance setting", async () => {
      const toggleHideAmount = jest.fn()
      await renderReview(buildBtcSettlementRoute(1000), true, toggleHideAmount)
      expect(screen.getByTestId("hidden-balance-placeholder")).toBeTruthy()

      fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))

      expect(screen.queryByTestId("hidden-balance-placeholder")).toBeNull()
      expect(screen.getByTestId(`${WalletCurrency.Btc} Wallet Balance`)).toBeTruthy()
      expect(toggleHideAmount).not.toHaveBeenCalled()
    })

    it("offers no tap on the wallet card while balances are visible", async () => {
      await renderReview(buildBtcSettlementRoute(1000))

      expect(
        screen.getByTestId("choose-wallet-to-send-from").props.accessibilityState
          ?.disabled,
      ).toBe(true)
    })
  })
})

describe("SendBitcoinConfirmationScreen — error message sheet", () => {
  let LL: ReturnType<typeof i18nObject>

  const lnurlRoute = () =>
    ({
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: {
        paymentDetail:
          PaymentDetailsLightning.createLnurlPaymentDetails(defaultLightningParams),
      },
    }) as const

  const asSelfCustodial = () =>
    useActiveWalletMock.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      needsBackendAuth: false,
      wallets: [],
      status: "ready",
      accountType: "SelfCustodial",
    })

  const failFee = (message: string) =>
    mockUseFee.mockReturnValue({
      status: "error",
      errors: [{ __typename: "GraphQLApplicationError", message }],
    })

  const renderReview = async (
    paymentRoute: Parameters<typeof Intraledger>[0]["route"],
  ) => {
    render(
      <ContextForScreen>
        <Intraledger route={paymentRoute} />
      </ContextForScreen>,
    )
    await flushEffects()
  }

  const slide = () =>
    act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

  const sheetButton = (label: string) =>
    within(screen.getByTestId(ERROR_SHEET_TEST_ID)).getByText(label)

  /** Runs the reducer "Try again" dispatched against a stack and returns the route names. */
  const startOverRoutes = (routeNames: string[]) => {
    const reducer = navigationDispatchMock.mock.calls
      .map(([action]) => action)
      .find((action) => typeof action === "function")
    const action = reducer({
      index: routeNames.length - 1,
      routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    }) as { type: string; payload: { routes: { name: string; key?: string }[] } }
    expect(action.type).toBe("RESET")
    return action.payload.routes
  }

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
    useActiveWalletMock.mockReturnValue({
      isSelfCustodial: false,
      isReady: true,
      needsBackendAuth: false,
      wallets: [],
      status: "ready",
      accountType: "Custodial",
    })
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

  it("stays closed while nothing has failed", async () => {
    await renderReview(route)

    expect(errorSheet()).toBeNull()
  })

  describe("fee quote (R2)", () => {
    it("opens titled 'A small problem' with Try again when a new amount can't fix it", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.Generic)
      await renderReview(route)

      const sheet = within(screen.getByTestId(ERROR_SHEET_TEST_ID))
      expect(sheet.getByText(LL.SendBitcoinScreen.problemSheetTitle())).toBeTruthy()
      expectInlineAndInSheet(LL.SelfCustodialError.generic())
      expect(sheet.getByText(LL.SendBitcoinConfirmationScreen.tryAgain())).toBeTruthy()
      expect(
        sheet.queryByText(LL.SendBitcoinConfirmationScreen.changeAmount()),
      ).toBeNull()
    })

    it("offers Change amount when the amount is the problem", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.InsufficientFunds)
      await renderReview(route)

      fireEvent.press(sheetButton(LL.SendBitcoinConfirmationScreen.changeAmount()))
      expectChangeAmountDispatched()
    })

    it("offers Try again instead when the invoice fixes the amount", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.InsufficientFunds)
      const fixedAmountRoute = {
        ...route,
        params: { paymentDetail: { ...paymentDetail, canSetAmount: false } },
      } as unknown as typeof route
      await renderReview(fixedAmountRoute)

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain())).toBeTruthy()
    })

    it("opens no sheet for a custodial fee error, which carries raw server text", async () => {
      mockUseFee.mockReturnValue({
        status: "error",
        errors: [
          { __typename: "GraphQLApplicationError", message: "Unable to find a route" },
        ],
      })
      await renderReview(route)

      expect(screen.getByText(LL.common.feeError())).toBeTruthy()
      expect(errorSheet()).toBeNull()
    })
  })

  describe("Try again", () => {
    it("replaces the send flow with a new destination screen", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.Generic)
      await renderReview(route)

      fireEvent.press(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain()))

      const routes = startOverRoutes([
        "Primary",
        "sendBitcoinDestination",
        "sendBitcoinDetails",
        "sendBitcoinConfirmation",
      ])
      expect(routes.map(({ name }) => name)).toEqual([
        "Primary",
        "sendBitcoinDestination",
      ])
      // A fresh screen, not the old one popped back to with what was entered.
      expect(routes[1].key).toBeUndefined()
    })

    it("adds a destination screen when the send was reached by scanning", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.Generic)
      await renderReview(route)

      fireEvent.press(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain()))

      expect(
        startOverRoutes(["Primary", "sendBitcoinDetails", "sendBitcoinConfirmation"]).map(
          ({ name }) => name,
        ),
      ).toEqual(["Primary", "sendBitcoinDestination"])
    })
  })

  describe("send failures", () => {
    it("goes Home for an invoice that is already paid (S3)", async () => {
      sendPaymentMock.mockResolvedValueOnce({ status: "ALREADY_PAID" })
      await renderReview(route)
      await slide()

      expectInlineAndInSheet(LL.SendBitcoinConfirmationScreen.invoiceAlreadyPaid())
      fireEvent.press(sheetButton(LL.SendBitcoinConfirmationScreen.home()))
      expect(navigationDispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "POP_TO_TOP" }),
      )
    })

    it("offers Try again for a custodial failure a new amount can't fix (S4)", async () => {
      sendPaymentMock.mockResolvedValueOnce({
        status: "FAILURE",
        errorsMessage: "Unable to find a route for payment.",
      })
      await renderReview(route)
      await slide()

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain())).toBeTruthy()
    })

    it("goes Home for a self-custodial generic failure on every rail, the Lightning address included (S10, N21)", async () => {
      asSelfCustodial()
      sendPaymentMock.mockResolvedValueOnce({
        status: "FAILURE",
        errorsMessage: SelfCustodialErrorCode.Generic,
      })
      const bitcoinToLightningAddress = {
        ...lnurlRoute(),
        params: {
          paymentDetail:
            PaymentDetailsLightning.createLnurlPaymentDetails<WalletCurrency>({
              ...defaultLightningParams,
              sendingWalletDescriptor: {
                id: "btc-wallet-id",
                currency: WalletCurrency.Btc,
              },
            }),
        },
      } as ReturnType<typeof lnurlRoute>
      render(
        <ContextForScreen>
          <LightningLnURL route={bitcoinToLightningAddress} />
        </ContextForScreen>,
      )
      await flushEffects()
      await slide()

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.home())).toBeTruthy()
      expect(
        within(screen.getByTestId(ERROR_SHEET_TEST_ID)).queryByText(
          LL.SendBitcoinConfirmationScreen.tryAgain(),
        ),
      ).toBeNull()
    })

    it("goes Home for a self-custodial send that threw, since it may have landed (S9)", async () => {
      asSelfCustodial()
      sendPaymentMock.mockRejectedValueOnce(new Error("network died"))
      await renderReview(route)
      await slide()

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.home())).toBeTruthy()
    })

    it("offers Try again when the SDK rejected the details before sending (S10 invalidInput)", async () => {
      asSelfCustodial()
      sendPaymentMock.mockResolvedValueOnce({
        status: "FAILURE",
        errorsMessage: SelfCustodialErrorCode.InvalidInput,
      })
      await renderReview(route)
      await slide()

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain())).toBeTruthy()
    })

    it("offers Try again when no idempotency key could be made, since nothing was sent (S8)", async () => {
      asSelfCustodial()
      sendPaymentMock.mockRejectedValueOnce(new Error(IDEMPOTENCY_KEY_UNAVAILABLE))
      await renderReview(route)
      await slide()

      expect(sheetButton(LL.SendBitcoinConfirmationScreen.tryAgain())).toBeTruthy()
    })

    it("offers Change amount after a self-custodial send rejected for the amount (S10)", async () => {
      asSelfCustodial()
      sendPaymentMock.mockResolvedValueOnce({
        status: "FAILURE",
        errorsMessage: SelfCustodialErrorCode.InsufficientFunds,
      })
      await renderReview(route)
      await slide()

      fireEvent.press(sheetButton(LL.SendBitcoinConfirmationScreen.changeAmount()))
      expectChangeAmountDispatched()
    })
  })

  describe("closing", () => {
    it("leaves the inline error when the sheet is closed, and opens again on the next failure", async () => {
      sendPaymentMock
        .mockResolvedValueOnce({ status: "FAILURE", errorsMessage: "route not found" })
        .mockResolvedValueOnce({ status: "FAILURE", errorsMessage: "route not found" })
      await renderReview(route)
      await slide()
      expect(errorSheet()).toBeTruthy()

      // The scrim behind the sheet is the close control.
      await act(async () => {
        fireEvent.press(screen.getByLabelText(LL.common.close()))
      })

      expect(errorSheet()).toBeNull()
      expect(screen.getByText("route not found")).toBeTruthy()

      // Same text, new failure: the sheet opens again.
      await slide()
      expect(errorSheet()).toBeTruthy()
    })

    it("stays closed while the same fee failure holds", async () => {
      asSelfCustodial()
      failFee(SelfCustodialErrorCode.Generic)
      await renderReview(route)

      await act(async () => {
        fireEvent.press(screen.getByLabelText(LL.common.close()))
      })
      await flushEffects()

      expect(errorSheet()).toBeNull()
      expect(screen.getByText(LL.SelfCustodialError.generic())).toBeTruthy()
    })
  })
})
