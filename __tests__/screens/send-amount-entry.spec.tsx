import React from "react"
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet } from "react-native"

import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { Screen } from "@app/components/screen"
import { PreferredAmountCurrency } from "@app/graphql/client-only-query"
import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import { INITIAL_FOCUS_DELAY_MS } from "@app/hooks/use-initial-accessibility-focus"
import {
  AMOUNT_SLIDER_TEST_ID,
  AmountSlider,
} from "@app/screens/send-bitcoin-screen/amount-entry/amount-slider"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  PaymentDestination,
  ResolvedIntraledgerPaymentDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import {
  createAmountLightningPaymentDetails,
  createIntraledgerPaymentDetails,
  createLnurlPaymentDetails,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details"
import { Satoshis, type LnUrlPayServiceResponse } from "lnurl-pay"
import { createSelfCustodialOnchainPaymentDetails } from "@app/self-custodial/payment-details/onchain"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  ZeroBtcMoneyAmount,
} from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { light } from "@app/rne-theme/colors"

import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(callback, [callback])
  },
}))

const mockHapticReject = jest.fn()
const mockHapticTap = jest.fn()

jest.mock("@app/utils/haptics", () => {
  const actual = jest.requireActual("@app/utils/haptics")
  return {
    ...actual,
    haptics: {
      ...actual.haptics,
      reject: () => mockHapticReject(),
      tap: () => mockHapticTap(),
    },
  }
})

/** Laid over the real fee options, so a spec can stand in a fee error the quote returned. */
const mockFeeTierOverride: { current: Record<string, unknown> } = { current: {} }
/** What the screen last handed the fee options, so a spec can read what it asked for. */
const mockFeeTierArgs = jest.fn()

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options", () => {
  const actual = jest.requireActual(
    "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options",
  )
  return {
    ...actual,
    useOnchainFeeTierOptions: (...args: unknown[]) => {
      mockFeeTierArgs(...args)
      return {
        ...actual.useOnchainFeeTierOptions(...args),
        ...mockFeeTierOverride.current,
      }
    },
  }
})

const mockIsIos = { current: true }

jest.mock("@app/utils/helper", () => {
  const actual = jest.requireActual("@app/utils/helper")
  return {
    ...actual,
    get isIos() {
      return mockIsIos.current
    },
  }
})

/** Set once the sender has slid to an amount on a send that went out. */
const mockHasLearnedAmountSlider: { current?: boolean } = {}

jest.mock("@app/store/persistent-state", () => ({
  ...jest.requireActual("@app/store/persistent-state"),
  usePersistentStateContext: () => ({
    persistentState: {
      schemaVersion: 12,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      hasLearnedAmountSlider: mockHasLearnedAmountSlider.current,
    },
    updateState: jest.fn(),
    resetState: jest.fn(),
  }),
}))

/** The real descriptors stay, since the screen helper builds its account from one. */
jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  AccountRegistryProvider: ({ children }: { children: React.ReactNode }) => children,
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: undefined,
    selfCustodialEntries: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

const mockDisplayCurrency = { current: "NGN" }

/** The currency the sender last swapped the keypad to, shared with review; unset leads with
 *  the display currency. */
const mockPreferredAmountCurrency: { current?: string } = {}
const mockSavePreferredAmountCurrency = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePreferredAmountCurrencyQuery: () => ({
    data: mockPreferredAmountCurrency.current
      ? { preferredAmountCurrency: mockPreferredAmountCurrency.current }
      : undefined,
  }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  ...jest.requireActual("@app/graphql/client-only-query"),
  savePreferredAmountCurrency: (_client: unknown, currency: string) =>
    mockSavePreferredAmountCurrency(currency),
}))

/**
 * The shared GraphQL mocks quote prices in NGN only, and the price hook drops a quote whose
 * denominator isn't the display currency. With USD as the display currency the specs use a
 * fixed converter instead: one sat is 0.024 cents, and the display currency is the dollar.
 */
const mockUsdCentsPerUnit: Record<string, number> = {
  BTC: 0.024,
  USD: 1,
  DisplayCurrency: 1,
}

jest.mock("@app/hooks/use-price-conversion", () => {
  const actual = jest.requireActual("@app/hooks/use-price-conversion")
  const convert = (
    moneyAmount: { amount: number; currency: string },
    toCurrency: string,
    round: (value: number) => number = Math.round,
  ) => ({
    amount:
      moneyAmount.currency === toCurrency
        ? moneyAmount.amount
        : round(
            (moneyAmount.amount * mockUsdCentsPerUnit[moneyAmount.currency]) /
              mockUsdCentsPerUnit[toCurrency],
          ),
    currency: toCurrency,
    currencyCode: toCurrency === "DisplayCurrency" ? "USD" : toCurrency,
  })
  const { createToDisplayAmount } = jest.requireActual("@app/types/amounts")
  const usdConverters = {
    convertMoneyAmount: convert,
    convertMoneyAmountWithRounding: convert,
    displayCurrency: "USD",
    toDisplayMoneyAmount: createToDisplayAmount("USD"),
    usdPerSat: "0.00024000",
  }
  return {
    ...actual,
    /** The real hook always runs, so a spec can change the display currency mid-render. */
    usePriceConversion: () => {
      const converters = actual.usePriceConversion()
      return mockDisplayCurrency.current === "USD" ? usdConverters : converters
    },
  }
})

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: mockDisplayCurrency.current,
    setDisplayCurrency: jest.fn(),
    loading: false,
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

// Pin the wallets so both are always on offer to the summary switch; MockedProvider
// serves each Apollo mock only once, which makes the query-driven wallet data
// flaky across the provider remounts that happen while the tree settles.
const btcWallet = {
  id: "f79792e3-282b-45d4-85d5-7486d020def5",
  balance: 88413,
  walletCurrency: "BTC",
}
const usdWallet = {
  id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
  balance: 158,
  walletCurrency: "USD",
}
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  ...jest.requireActual("@app/screens/send-bitcoin-screen/hooks/use-send-wallets"),
  useSendWallets: () => ({
    wallets: [btcWallet, usdWallet],
    defaultWallet: btcWallet,
    btcWallet,
    usdWallet,
    network: "mainnet",
    loading: false,
    get isSelfCustodial() {
      return mockIsSelfCustodial.current
    },
  }),
}))

const mockIsSelfCustodial = { current: false }

/** The SDK edge only: everything between it and the screen runs for real. */
const mockPrepareSend = jest.fn()
const mockSelfCustodialWallet = { sdk: { id: "sdk" } }

jest.mock("@app/self-custodial/bridge", () => ({
  prepareSend: (...args: unknown[]) => mockPrepareSend(...args),
  extractOnchainFees: () => ({ fast: 300, medium: 200, slow: 100 }),
}))
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet,
}))

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

loadLocale("en")
const LL = i18nObject("en")

beforeEach(() => {
  loadLocale("en")
  mockSetAmount.mockClear()
  mockNavigate.mockClear()
  mockFeeTierOverride.current = {}
  mockFeeTierArgs.mockClear()
  mockHapticReject.mockClear()
  mockHapticTap.mockClear()
  mockSavePreferredAmountCurrency.mockClear()
  mockHapticTap.mockClear()
  mockDisplayCurrency.current = "NGN"
  mockPreferredAmountCurrency.current = undefined
  mockHasLearnedAmountSlider.current = undefined
})

const mockSetAmount = jest.fn()

/**
 * Wraps a payment detail so every amount the screen hands it is recorded, through each
 * rebuild the screen makes. `canSendMax` is forced where a spec needs the send-all branch
 * without standing up an on-chain fee quote.
 */
const recordAmounts = <T extends WalletCurrency>(
  detail: PaymentDetail<T>,
  overrides: { canSendMax?: boolean } = {},
): PaymentDetail<T> => {
  const wrapped = {
    ...detail,
    ...overrides,
    setConvertMoneyAmount: (
      convert: Parameters<typeof detail.setConvertMoneyAmount>[0],
    ) => recordAmounts(detail.setConvertMoneyAmount(convert), overrides),
    setSendingWalletDescriptor: (
      descriptor: Parameters<typeof detail.setSendingWalletDescriptor>[0],
    ) => recordAmounts(detail.setSendingWalletDescriptor(descriptor), overrides),
  }
  if (!detail.setAmount) return wrapped as PaymentDetail<T>
  const setAmount = detail.setAmount
  return {
    ...wrapped,
    setAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>, sendMax?: boolean) => {
      mockSetAmount(amount, sendMax)
      return recordAmounts(setAmount(amount, sendMax), overrides)
    },
  } as PaymentDetail<T>
}

const intraledgerWalletId = "f79792e3-282b-45d4-85d5-7486d020def5"
const intraledgerHandle = "test"

const intraledgerValidDestination: ResolvedIntraledgerPaymentDestination = {
  valid: true,
  walletId: intraledgerWalletId,
  paymentType: PaymentType.Intraledger,
  handle: intraledgerHandle,
}

const intraledgerDestination = (overrides: { canSendMax?: boolean } = {}) =>
  ({
    valid: true,
    validDestination: intraledgerValidDestination,
    destinationDirection: DestinationDirection.Send,
    createPaymentDetail: <T extends WalletCurrency>({
      convertMoneyAmount,
      sendingWalletDescriptor,
    }: CreatePaymentDetailParams<T>) =>
      recordAmounts(
        createIntraledgerPaymentDetails({
          handle: intraledgerHandle,
          recipientWalletId: intraledgerWalletId,
          sendingWalletDescriptor,
          convertMoneyAmount,
          unitOfAccountAmount: ZeroBtcMoneyAmount,
        }),
        overrides,
      ),
  }) as PaymentDestination

const invoiceDestination = {
  valid: true,
  validDestination: {
    valid: true,
    paymentType: PaymentType.Lightning,
    paymentRequest: "lnbc10u1invoice",
  },
  destinationDirection: DestinationDirection.Send,
  createPaymentDetail: <T extends WalletCurrency>({
    convertMoneyAmount,
    sendingWalletDescriptor,
  }: CreatePaymentDetailParams<T>) =>
    createAmountLightningPaymentDetails({
      paymentRequest: "lnbc10u1invoice",
      paymentRequestAmount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
      destinationSpecifiedMemo: "Pay to Próspera",
      sendingWalletDescriptor,
      convertMoneyAmount,
    }),
} as unknown as PaymentDestination

const sendScreen = (
  paymentDestination: PaymentDestination,
  { hideAmount = false }: { hideAmount?: boolean } = {},
) => (
  <ContextForScreen>
    <HideAmountContextProvider value={{ hideAmount, toggleHideAmount: jest.fn() }}>
      <SendBitcoinDetailsScreen
        route={{
          key: "sendBitcoinDetailsScreen",
          name: "sendBitcoinDetails",
          params: { paymentDestination },
        }}
      />
    </HideAmountContextProvider>
  </ContextForScreen>
)

const renderScreen = (...args: Parameters<typeof sendScreen>) =>
  render(sendScreen(...args))

const settle = async () => {
  await flushAsync()
  await flushAsync()
}

const nextButton = () => screen.getByTestId(LL.common.next())
const isNextDisabled = () => nextButton().props.accessibilityState?.disabled

const typeKeys = (...keys: string[]) =>
  keys.forEach((key) => fireEvent.press(screen.getByTestId(`Key ${key}`)))

/** The slider's own drag is covered in amount-slider.spec.tsx; here it hands a percent over. */
const amountSlider = () => screen.UNSAFE_getByType(AmountSlider)
const slideTo = (percent: number) => act(() => amountSlider().props.onSlide(percent))

describe("free amount", () => {
  /** The keypad's tap reaches the screen's pad: one per accepted key, none for a refused
   *  one. It buzzes in Android silent mode too, see haptics.spec.ts. */
  it("taps once per accepted key and stays silent on a refused one", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    fireEvent.press(screen.getByTestId("Key ⌫"))
    await settle()
    expect(mockHapticTap).not.toHaveBeenCalled()

    typeKeys("1", "2")
    await settle()
    expect(mockHapticTap).toHaveBeenCalledTimes(2)
  })

  /** The empty backspace above never reaches the pad: the key is disabled. A third decimal
   *  digit is enabled, so the pad itself has to refuse it. Naira takes no decimals here,
   *  so the dollar is the display currency. */
  it("leaves the amount and stays silent when the pad refuses an enabled key", async () => {
    mockDisplayCurrency.current = "USD"
    renderScreen(intraledgerDestination())
    await settle()
    const primary = () => screen.getByTestId("send-hero-amount-primary").props.children

    typeKeys("1", ".", "2", "3")
    await settle()
    expect(primary()).toBe("$1.23")
    expect(mockHapticTap).toHaveBeenCalledTimes(4)

    typeKeys("4")
    await settle()
    expect(primary()).toBe("$1.23")
    expect(mockHapticTap).toHaveBeenCalledTimes(4)
  })

  it("repeats a held backspace every 300 ms and stops at an empty amount", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    const primary = () => screen.getByTestId("send-hero-amount-primary").props.children
    typeKeys("1", "2", "3")
    await settle()
    expect(primary()).toBe("₦123")
    mockHapticTap.mockClear()

    jest.useFakeTimers()
    try {
      fireEvent(screen.getByTestId("Key ⌫"), "pressIn")
      const seen = ["₦12", "₦1", "₦0"].map(() => {
        act(() => {
          jest.advanceTimersByTime(300)
        })
        return primary()
      })
      expect(seen).toEqual(["₦12", "₦1", "₦0"])

      /** At an empty amount backspace disables, which ends the repeat: a digit typed
       *  while the key is still held survives the ticks that would have followed. */
      act(() => {
        jest.advanceTimersByTime(300)
      })
      typeKeys("7")
      act(() => {
        jest.advanceTimersByTime(900)
      })
      expect(primary()).toBe("₦7")
      fireEvent(screen.getByTestId("Key ⌫"), "pressOut")
      // One for the whole hold, one for the 7.
      expect(mockHapticTap).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it("opens with the keypad, the amount slider and a disabled Add amount", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    expect(screen.getByTestId("Key 1")).toBeTruthy()
    expect(screen.getByTestId(AMOUNT_SLIDER_TEST_ID)).toBeTruthy()
    // The slider replaces the percent chips.
    expect(screen.queryByTestId("send-25%")).toBeNull()
    expect(within(nextButton()).getByText(LL.SendBitcoinScreen.addAmount())).toBeTruthy()
    // Read as what it shows, not as its test ID "Next".
    expect(nextButton().props.accessibilityLabel).toBe(LL.SendBitcoinScreen.addAmount())
    expect(isNextDisabled()).toBe(true)
  })

  it("turns the call to action into an enabled Next once an amount is typed", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("1")
    await settle()

    expect(within(nextButton()).getByText(LL.common.next())).toBeTruthy()
    expect(isNextDisabled()).toBe(false)
  })

  it("mutes both amount lines until an amount is typed", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    const colorOf = (testID: string) =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style).color

    const emptyPrimary = colorOf("send-hero-amount-primary")
    const emptySecondary = colorOf("send-hero-amount-secondary")
    typeKeys("1")
    await settle()

    // Empty reads grey2 over grey3; active steps each line up one, so the typed
    // secondary takes the grey the empty primary had.
    expect(emptyPrimary).not.toBe(emptySecondary)
    expect(colorOf("send-hero-amount-secondary")).toBe(emptyPrimary)
    expect(colorOf("send-hero-amount-primary")).not.toBe(emptyPrimary)
  })

  it("sets the slider's share of the selected wallet's balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(50)
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: Math.floor(btcWallet.balance / 2), currency: "BTC", currencyCode: "BTC" },
      false,
    )
    expect(isNextDisabled()).toBe(false)
  })

  /** A Blink-to-Blink send has no fee, so it is a send-all rail of its own (#2048 SA7). */
  it("sends the whole balance as a send-all where the rail supports one", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(100)
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: btcWallet.balance, currency: "BTC", currencyCode: "BTC" },
      true,
    )
  })

  /** #2048: typing an amount, or sliding back under 100%, puts the fee back on top. */
  it("turns the send-all off once an amount is typed after 100%", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(100)
    await settle()
    fireEvent.press(screen.getByTestId("Key ⌫"))
    await settle()

    expect(mockSetAmount.mock.calls.at(-1)?.[1]).toBeFalsy()
  })

  it("turns the send-all off when the slider goes back under 100%", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(100)
    await settle()
    slideTo(90)
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: Math.floor((btcWallet.balance * 90) / 100) }),
      false,
    )
  })

  it("sends 100% as a plain amount where the rail has no send-all", async () => {
    renderScreen(intraledgerDestination({ canSendMax: false }))
    await settle()

    slideTo(100)
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: btcWallet.balance, currency: "BTC", currencyCode: "BTC" },
      false,
    )
  })

  /** The light refusal for an amount fixed in place: once as it goes over, not again while
   *  it stays over, and again after it comes back under and goes over once more. */
  it("buzzes a refusal each time the amount goes over the balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("2", "2")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    typeKeys("2")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId("Key ⌫"))
    fireEvent.press(screen.getByTestId("Key ⌫"))
    await settle()
    typeKeys("2")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(2)
  })

  /** ₦22 is past the bitcoin balance against the mocked price (see the switch spec below). */
  it("reads Low funds and outlines the wallet when the amount exceeds its balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    const cardBorder = () =>
      StyleSheet.flatten(screen.getByTestId("choose-wallet-to-send-from").props.style)
        .borderColor

    const borderBefore = cardBorder()
    typeKeys("2", "2")
    await settle()

    expect(within(nextButton()).getByText(LL.SendBitcoinScreen.lowFunds())).toBeTruthy()
    expect(nextButton().props.accessibilityLabel).toBe(LL.SendBitcoinScreen.lowFunds())
    expect(isNextDisabled()).toBe(true)
    expect(cardBorder()).not.toBe(borderBefore)
  })

  /** Against the mocked price ₦22 is about 91,600 sats but only $0.22: past the bitcoin
   *  balance of 88,413 sats, inside the dollar wallet's $1.58. */
  it("re-checks the typed amount against the wallet it switches to", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("2", "2")
    await settle()
    expect(isNextDisabled()).toBe(true)

    fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))
    await settle()

    expect(screen.getByTestId(`${WalletCurrency.Usd} Wallet Balance`)).toBeTruthy()
    expect(isNextDisabled()).toBe(false)
  })
  /** The keypad keeps digits, not an amount. When the display currency changes under it
   *  (a rate arriving or being lost), it has to re-read the amount that will be sent, or
   *  "22" typed in naira would read, and keep typing, as $22. */
  it("re-reads the typed amount when the display currency changes mid-entry", async () => {
    const destination = intraledgerDestination()
    const view = renderScreen(destination)
    await settle()
    typeKeys("2", "2")
    await settle()

    mockDisplayCurrency.current = "USD"
    view.rerender(sendScreen(destination))
    await settle()

    const [carried] = mockSetAmount.mock.calls[mockSetAmount.mock.calls.length - 1]
    expect(carried.currency).toBe(WalletCurrency.Btc)
    const cents = Math.round(carried.amount * mockUsdCentsPerUnit.BTC)
    expect(screen.getByTestId("send-hero-amount-primary").props.children).toBe(
      `$${(cents / 100).toFixed(2)}`,
    )

    typeKeys("⌫")
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      {
        amount: Math.floor(cents / 10) * 10,
        currency: "DisplayCurrency",
        currencyCode: "USD",
      },
      undefined,
    )
  })
})

/**
 * End to end from the SDK edge: the quote travels through the fee rail and the options
 * hook to the screen. The SDK reserves the wallet's funds to quote, so it is asked once,
 * on Next, and never while the amount is typed.
 */
describe("LNURL bounds", () => {
  const lnurlDestination = (bounds: { min: number; max: number }) => {
    const lnurlParams: LnUrlPayServiceResponse = {
      callback: "https://example.com/cb",
      fixed: false,
      min: bounds.min as Satoshis,
      max: bounds.max as Satoshis,
      domain: "example.com",
      metadata: [["text/plain", "Pay alice"]],
      metadataHash: "",
      identifier: "alice@example.com",
      description: "Pay alice",
      image: "",
      commentAllowed: 0,
      rawData: { metadata: '[["text/plain","Pay alice"]]' },
    }
    return {
      valid: true,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Lnurl,
        lnurl: "lnurl1alice",
        lnurlParams,
      },
      destinationDirection: DestinationDirection.Send,
      createPaymentDetail: <T extends WalletCurrency>({
        convertMoneyAmount,
        sendingWalletDescriptor,
      }: CreatePaymentDetailParams<T>) =>
        recordAmounts(
          createLnurlPaymentDetails({
            lnurl: "lnurl1alice",
            lnurlParams,
            unitOfAccountAmount: ZeroBtcMoneyAmount,
            convertMoneyAmount,
            sendingWalletDescriptor,
            isMerchant: false,
          }),
        ),
    } as unknown as PaymentDestination
  }

  const minNotMetText = /Amount must be at least/
  const maxExceededText = /Amount must not exceed/

  /** Every amount starts under a minimum as it is typed: ₦1 is about 4,200 sats, under the
   *  10,000 minimum, on the way to ₦15, which is inside it and the balance. The inline text
   *  says so while it lasts, but nothing was refused. */
  it("stays silent while the amount is typed up past the minimum", async () => {
    renderScreen(lnurlDestination({ min: 10000, max: 1000000 }))
    await settle()

    typeKeys("1")
    await settle()
    expect(screen.getByText(minNotMetText)).toBeTruthy()
    expect(isNextDisabled()).toBe(true)

    typeKeys("5")
    await settle()
    expect(screen.queryByText(minNotMetText)).toBeNull()
    expect(isNextDisabled()).toBe(false)

    expect(mockHapticTap).toHaveBeenCalledTimes(2)
    expect(mockHapticReject).not.toHaveBeenCalled()
  })

  /** Over a maximum, each further digit only goes further over: ₦5 is about 20,800 sats,
   *  past the 10,000 maximum. Once as it goes over, not again while it stays over, and
   *  again after it comes back and goes over once more. */
  it("buzzes a refusal each time the amount goes over the maximum", async () => {
    renderScreen(lnurlDestination({ min: 1, max: 10000 }))
    await settle()

    typeKeys("5")
    await settle()
    expect(screen.getByText(maxExceededText)).toBeTruthy()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    typeKeys("1")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId("Key ⌫"))
    fireEvent.press(screen.getByTestId("Key ⌫"))
    await settle()
    expect(screen.queryByText(maxExceededText)).toBeNull()

    typeKeys("5")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(2)
  })
})

describe("a self-custodial on-chain fee", () => {
  const ONCHAIN_ADDRESS = "bc1qamountentryspec"
  /** ₦1 is about 4,164 sats against the mocked price, ₦10 about 41,640. */
  const MINIMUM_SATS = 30000
  const tooLow = LL.SendBitcoinScreen.sdkAmountTooLow()

  const onchainDestination = {
    valid: true,
    validDestination: {
      valid: true,
      paymentType: PaymentType.Onchain,
      address: ONCHAIN_ADDRESS,
    },
    destinationDirection: DestinationDirection.Send,
    createPaymentDetail: <T extends WalletCurrency>({
      convertMoneyAmount,
      sendingWalletDescriptor,
    }: CreatePaymentDetailParams<T>) =>
      createSelfCustodialOnchainPaymentDetails({
        sdk: mockSelfCustodialWallet.sdk as never,
        address: ONCHAIN_ADDRESS,
        unitOfAccountAmount: ZeroBtcMoneyAmount,
        convertMoneyAmount,
        sendingWalletDescriptor,
      }),
  } as unknown as PaymentDestination

  beforeEach(() => {
    mockIsSelfCustodial.current = true
    mockPrepareSend.mockReset()
    mockPrepareSend.mockImplementation(
      async (_sdk: unknown, { amount }: { amount: bigint }) => {
        if (amount < BigInt(MINIMUM_SATS)) {
          // The SDK's typed error, told apart by its tag as the rail reads it.
          throw Object.assign(new Error("amount too low"), { tag: "InvalidInput" })
        }
        return {}
      },
    )
  })

  afterEach(() => {
    mockIsSelfCustodial.current = false
  })

  it("is not quoted while the amount is typed", async () => {
    renderScreen(onchainDestination)
    await settle()

    typeKeys("1")
    await settle()
    typeKeys("0")
    await settle()

    expect(mockPrepareSend).not.toHaveBeenCalled()
    expect(isNextDisabled()).toBe(false)
  })

  it("is quoted once on Next, then goes to review", async () => {
    renderScreen(onchainDestination)
    await settle()
    typeKeys("1", "0")
    await settle()

    fireEvent.press(nextButton())
    await settle()

    expect(mockPrepareSend).toHaveBeenCalledTimes(1)
    const [, { amount }] = mockPrepareSend.mock.calls[0]
    expect(amount).toBeGreaterThanOrEqual(BigInt(MINIMUM_SATS))
    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ paymentDetail: expect.anything() }),
    )
  })

  it("says the amount is too low on Next, and holds the send", async () => {
    renderScreen(onchainDestination)
    await settle()

    typeKeys("1")
    await settle()

    expect(screen.queryByText(tooLow)).toBeNull()
    expect(isNextDisabled()).toBe(false)
    expect(mockHapticReject).not.toHaveBeenCalled()

    fireEvent.press(nextButton())
    await settle()

    expect(screen.getByText(tooLow)).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)
  })

  /** The light refusal of an amount fixed in place, like Low funds: once per showing. An
   *  amount change hides the error, so the next Next that shows it buzzes again. */
  it("buzzes a refusal each time Next shows the amount is too low", async () => {
    renderScreen(onchainDestination)
    await settle()
    typeKeys("1")
    await settle()

    fireEvent.press(nextButton())
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId("Key ⌫"))
    typeKeys("2")
    await settle()
    expect(screen.queryByText(tooLow)).toBeNull()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    fireEvent.press(nextButton())
    await settle()
    expect(screen.getByText(tooLow)).toBeTruthy()
    expect(mockHapticReject).toHaveBeenCalledTimes(2)
  })

  it("stays silent for a fee error no amount fixes", async () => {
    mockPrepareSend.mockRejectedValueOnce(new Error("Failed to select leaves"))
    renderScreen(onchainDestination)
    await settle()
    typeKeys("1", "0")
    await settle()

    fireEvent.press(nextButton())
    await settle()

    expect(screen.getByText(LL.SendBitcoinScreen.sdkGenericError())).toBeTruthy()
    expect(mockHapticReject).not.toHaveBeenCalled()
  })

  /** The reported bug: a quote that failed for a cause no amount fixes left the sender
   *  stuck until they typed a different amount. Next stays on and asks again. */
  it("keeps Next on after a failed quote, and pressing it again retries", async () => {
    mockPrepareSend.mockRejectedValueOnce(new Error("Failed to select leaves"))
    renderScreen(onchainDestination)
    await settle()
    typeKeys("1", "0")
    await settle()

    fireEvent.press(nextButton())
    await settle()

    expect(screen.getByText(LL.SendBitcoinScreen.sdkGenericError())).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(isNextDisabled()).toBe(false)

    fireEvent.press(nextButton())
    await settle()

    expect(mockPrepareSend).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(LL.SendBitcoinScreen.sdkGenericError())).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.anything(),
    )
  })

  /** The 200 sat Standard fee Next gets back is more than half of a 300 sat send. */
  it("judges the fee Next quoted for the high-fee sheet", async () => {
    mockPrepareSend.mockResolvedValue({})
    renderScreen(onchainDestination)
    await settle()
    fireEvent.press(screen.getByTestId("send-hero-amount-primary"))
    await settle()
    typeKeys("3", "0", "0")
    await settle()

    fireEvent.press(nextButton())
    await settle()

    expect(mockPrepareSend).toHaveBeenCalledTimes(1)
    expect(screen.getByText(LL.SendBitcoinScreen.highFeeSheet.title())).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("tells review the slider was used when the high-fee sheet is accepted", async () => {
    mockPrepareSend.mockResolvedValue({})
    renderScreen(onchainDestination)
    await settle()
    slideTo(1)
    await settle()
    fireEvent.press(screen.getByTestId("send-hero-amount-primary"))
    await settle()
    for (let i = 0; i < 8; i += 1) fireEvent.press(screen.getByTestId("Key ⌫"))
    typeKeys("3", "0", "0")
    await settle()
    fireEvent.press(nextButton())
    await settle()

    fireEvent.press(screen.getByText(LL.SendBitcoinScreen.highFeeSheet.acceptFee()))
    await settle()

    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ usedAmountSlider: true }),
    )
  })

  /** The quote is for the payment on screen when Next was pressed, so nothing on that
   *  payment may change until it lands: review would get a tier or note the user left. */
  describe("while the quote after Next is out", () => {
    const holdQuote = () => {
      let release: () => void = () => {}
      mockPrepareSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({})
          }),
      )
      return () => release()
    }

    it("holds the keypad, slider, wallet switch, priority and note, then goes to review", async () => {
      const release = holdQuote()
      renderScreen(onchainDestination)
      await settle()
      typeKeys("1", "0")
      await settle()

      fireEvent.press(nextButton())
      await settle()

      expect(screen.getByTestId("Key 1").props.accessibilityState?.disabled).toBe(true)
      expect(
        screen.getByTestId("choose-wallet-to-send-from").props.accessibilityState
          ?.disabled,
      ).toBe(true)
      expect(
        screen.getByTestId("fee-tier-dropdown").props.accessibilityState?.disabled,
      ).toBe(true)
      expect(screen.getByTestId("add-note").props.editable).toBe(false)
      expect(
        screen.getByTestId(AMOUNT_SLIDER_TEST_ID).props.accessibilityState?.disabled,
      ).toBe(true)
      expect(mockNavigate).not.toHaveBeenCalled()

      await act(async () => release())
      await settle()

      expect(mockPrepareSend).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith(
        "sendBitcoinConfirmation",
        expect.anything(),
      )
      expect(screen.getByTestId("Key 1").props.accessibilityState?.disabled).toBe(false)
      expect(screen.getByTestId("add-note").props.editable).toBe(true)
      expect(
        screen.getByTestId(AMOUNT_SLIDER_TEST_ID).props.accessibilityState?.disabled,
      ).toBe(false)
    })

    it("stays on the screen when the payment changed under the quote", async () => {
      const release = holdQuote()
      renderScreen(onchainDestination)
      await settle()
      typeKeys("1", "0")
      await settle()

      fireEvent.press(nextButton())
      await settle()
      // An edit that lands anyway, as a keyboard can commit text after the field locks.
      await act(async () => {
        screen.getByTestId("add-note").props.onChangeText("late note")
      })

      await act(async () => release())
      await settle()

      expect(mockNavigate).not.toHaveBeenCalled()
      expect(isNextDisabled()).toBe(false)

      fireEvent.press(nextButton())
      await settle()

      expect(mockNavigate).toHaveBeenCalledWith(
        "sendBitcoinConfirmation",
        expect.objectContaining({
          paymentDetail: expect.objectContaining({ memo: "late note" }),
        }),
      )
    })
  })

  it("leaves nothing to show once the amount clears the minimum", async () => {
    renderScreen(onchainDestination)
    await settle()
    typeKeys("1")
    await settle()
    fireEvent.press(nextButton())
    await settle()

    typeKeys("0")
    await settle()

    expect(screen.queryByText(tooLow)).toBeNull()
    expect(isNextDisabled()).toBe(false)
  })
})

/** blink-mobile#4261: the backend refused the custodial fee quote because the address is
 *  the sending wallet's own. Stood in through the fee options; the hook specs cover how the
 *  refusal is told apart. */
describe("a custodial on-chain payment to the sender's own address", () => {
  const selfPayment = LL.SendBitcoinScreen.onchainSelfPayment()

  it("says so in place of the fee error, and holds Next", async () => {
    mockFeeTierOverride.current = {
      feeTierErrorMessage: selfPayment,
      isSelfPayment: true,
    }
    renderScreen(intraledgerDestination())
    await settle()
    typeKeys("1")
    await settle()

    // Inline, and in the error message sheet opened over it.
    expect(screen.getAllByText(selfPayment)).toHaveLength(2)
    expect(screen.queryByText(LL.common.feeError())).toBeNull()
    expect(isNextDisabled()).toBe(true)
    // The sheet's error haptic is the one buzz; the inline error adds no refusal.
    expect(mockHapticReject).not.toHaveBeenCalled()
  })

  it("leaves Next on for any other fee error, as before", async () => {
    mockFeeTierOverride.current = {
      feeTierErrorMessage: LL.common.feeError(),
      isSelfPayment: false,
    }
    renderScreen(intraledgerDestination())
    await settle()
    typeKeys("1")
    await settle()

    expect(screen.getByText(LL.common.feeError())).toBeTruthy()
    expect(isNextDisabled()).toBe(false)
    expect(mockHapticReject).not.toHaveBeenCalled()
  })
})

describe("amount slider", () => {
  it("shows 'Slide to select amount' until the slider is learned", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    // Read out as the slider's own label, so the caption itself is hidden from readers.
    expect(
      screen.getByText(LL.SendBitcoinScreen.slideToSelectAmount(), {
        includeHiddenElements: true,
      }),
    ).toBeTruthy()
  })

  it("drops the hint once a slid send has gone out", async () => {
    mockHasLearnedAmountSlider.current = true
    renderScreen(intraledgerDestination())
    await settle()

    expect(screen.getByTestId(AMOUNT_SLIDER_TEST_ID)).toBeTruthy()
    expect(
      screen.queryByText(LL.SendBitcoinScreen.slideToSelectAmount(), {
        includeHiddenElements: true,
      }),
    ).toBeNull()
  })

  it("moves the thumb to a typed amount's share of the balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    expect(amountSlider().props.share).toBe(0)

    typeKeys("1", "0", "0")
    await settle()
    const typedShare = amountSlider().props.share
    typeKeys("0")
    await settle()

    expect(typedShare).toBeGreaterThan(0)
    // A tenfold amount sits ten times as far along, give or take a sat of rounding.
    expect(amountSlider().props.share / typedShare).toBeCloseTo(10, 3)
  })

  it("puts the thumb at a slid share of the balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(50)
    await settle()

    expect(amountSlider().props.share).toBeCloseTo(0.5, 2)
  })

  it("tells review the amount came from the slider", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(25)
    await settle()
    fireEvent.press(nextButton())
    await settle()

    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ usedAmountSlider: true }),
    )
  })

  // Ruled 2026-11-17: a sender who slid has seen the slider work, whatever they typed after.
  it("still tells review the slider was used when the amount is typed over after", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    slideTo(25)
    await settle()
    typeKeys("⌫", "1")
    await settle()
    fireEvent.press(nextButton())
    await settle()

    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ usedAmountSlider: true }),
    )
  })

  it("tells review a typed amount did not", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("1")
    await settle()
    fireEvent.press(nextButton())
    await settle()

    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ usedAmountSlider: false }),
    )
  })

  describe("the on-chain fee quote", () => {
    const isAmountSliding = () =>
      (mockFeeTierArgs.mock.lastCall?.[0] as { isAmountSliding?: boolean })
        .isAmountSliding
    const hold = () => act(() => amountSlider().props.onHoldChange(true))
    const letGo = () => act(() => amountSlider().props.onHoldChange(false))

    it("waits while a held thumb moves the amount, and goes out on release", async () => {
      renderScreen(intraledgerDestination())
      await settle()

      expect(isAmountSliding()).toBe(false)
      hold()
      slideTo(50)
      expect(isAmountSliding()).toBe(true)
      letGo()
      expect(isAmountSliding()).toBe(false)
    })

    // A touch that changes nothing would drop a valid quote and ask for the same fee again.
    it("keeps the quote it has when a touch leaves the amount where it was", async () => {
      renderScreen(intraledgerDestination())
      await settle()
      slideTo(30)
      await settle()

      hold()
      slideTo(30)

      expect(isAmountSliding()).toBe(false)
    })

    it("starts each hold afresh after an amount set outside one", async () => {
      renderScreen(intraledgerDestination())
      await settle()
      slideTo(30)
      await settle()

      hold()

      expect(isAmountSliding()).toBe(false)
    })
  })

  describe("with a screen reader", () => {
    const swipe = (actionName: "increment" | "decrement") =>
      act(() =>
        fireEvent(screen.getByTestId(AMOUNT_SLIDER_TEST_ID), "accessibilityAction", {
          nativeEvent: { actionName },
        }),
      )

    it("steps the amount a tenth of the balance a swipe", async () => {
      renderScreen(intraledgerDestination())
      await settle()

      swipe("increment")
      await settle()
      swipe("increment")
      await settle()

      expect(mockSetAmount).toHaveBeenLastCalledWith(
        {
          amount: Math.floor(btcWallet.balance / 5),
          currency: "BTC",
          currencyCode: "BTC",
        },
        false,
      )
      expect(screen.getByTestId(AMOUNT_SLIDER_TEST_ID).props.accessibilityValue.now).toBe(
        20,
      )
    })

    it("reaches the send-all where the rail supports one", async () => {
      renderScreen(intraledgerDestination({ canSendMax: true }))
      await settle()

      slideTo(90)
      await settle()
      swipe("increment")
      await settle()

      expect(mockSetAmount).toHaveBeenLastCalledWith(
        { amount: btcWallet.balance, currency: "BTC", currencyCode: "BTC" },
        true,
      )
    })

    it("tells review the slider was used", async () => {
      renderScreen(intraledgerDestination())
      await settle()

      swipe("increment")
      await settle()
      fireEvent.press(nextButton())
      await settle()

      expect(mockNavigate).toHaveBeenCalledWith(
        "sendBitcoinConfirmation",
        expect.objectContaining({ usedAmountSlider: true }),
      )
    })
  })

  describe("on a wallet switch", () => {
    const switchWallet = async () => {
      fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))
      await settle()
    }

    it("measures the amount against the new wallet's balance", async () => {
      renderScreen(intraledgerDestination())
      await settle()
      slideTo(50)
      await settle()
      const bitcoinShare = amountSlider().props.share

      await switchWallet()

      expect(bitcoinShare).toBeCloseTo(0.5, 2)
      expect(amountSlider().props.share).not.toBeCloseTo(bitcoinShare, 2)
    })

    it("turns the fill green for the Dollar wallet", async () => {
      renderScreen(intraledgerDestination())
      await settle()
      expect(amountSlider().props.accentColor).toBe(light.accent)

      await switchWallet()

      expect(amountSlider().props.accentColor).toBe(light.success)
    })

    it("no longer sends all after a 100% slide", async () => {
      renderScreen(intraledgerDestination({ canSendMax: true }))
      await settle()
      slideTo(100)
      await settle()
      expect(mockSetAmount).toHaveBeenLastCalledWith(expect.anything(), true)
      mockSetAmount.mockClear()

      await switchWallet()

      // The amount is set again in the new wallet, as a plain amount.
      expect(mockSetAmount).toHaveBeenCalled()
      expect(mockSetAmount.mock.lastCall?.[1]).not.toBe(true)
    })
  })

  it("holds the screen's scroll while the thumb is held", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    const scrollEnabled = () =>
      screen
        .UNSAFE_getAllByType(ScrollView)
        .find((node) => node.props.keyboardShouldPersistTaps === "handled")!.props
        .scrollEnabled

    act(() => amountSlider().props.onHoldChange(true))
    expect(scrollEnabled()).toBe(false)

    act(() => amountSlider().props.onHoldChange(false))
    expect(scrollEnabled()).toBe(true)
  })
})

describe("fixed amount", () => {
  it("hides the keypad and slider and offers Next straight away", async () => {
    renderScreen(invoiceDestination)
    await settle()

    expect(screen.queryByTestId("Key 1")).toBeNull()
    expect(screen.queryByTestId(AMOUNT_SLIDER_TEST_ID)).toBeNull()
    expect(within(nextButton()).getByText(LL.common.next())).toBeTruthy()
    expect(isNextDisabled()).toBe(false)
  })

  it("shows the invoice description in a note the user can't edit", async () => {
    renderScreen(invoiceDestination)
    await settle()

    const note = screen.getByTestId("add-note")
    expect(note.props.value).toBe("Pay to Próspera")
    expect(note.props.editable).toBe(false)
  })

  it("keeps the invoice amount and re-checks it when the wallet switches", async () => {
    renderScreen(invoiceDestination)
    await settle()
    const amountBefore = screen.getByTestId("send-hero-amount-primary").props.children

    fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))
    await settle()

    expect(screen.getByTestId("send-hero-amount-primary").props.children).toBe(
      amountBefore,
    )
    expect(screen.getByTestId(`${WalletCurrency.Usd} Wallet Balance`)).toBeTruthy()
    expect(
      screen.queryByText(
        new RegExp(`^${LL.SendBitcoinScreen.amountExceed({ balance: "" }).trim()}`),
      ),
    ).toBeNull()
  })
})

describe("amount currency", () => {
  const heroLines = () => [
    screen.getByTestId("send-hero-amount-primary").props.children,
    screen.queryByTestId("send-hero-amount-secondary")?.props.children,
  ]

  it("types in the display currency when the sender has not chosen one", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    expect(heroLines()[0]).toMatch(/^₦/)
  })

  it("types in sats when the sender last chose sats", async () => {
    mockPreferredAmountCurrency.current = PreferredAmountCurrency.Default
    renderScreen(intraledgerDestination())
    await settle()

    expect(heroLines()[0]).toMatch(/ SAT$/)
  })

  it("saves each swap as the currency review and the next send lead with", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    fireEvent.press(screen.getByTestId("send-hero-amount-primary"))
    await settle()
    expect(mockSavePreferredAmountCurrency).toHaveBeenLastCalledWith(
      PreferredAmountCurrency.Default,
    )
    expect(heroLines()[0]).toMatch(/ SAT$/)

    fireEvent.press(screen.getByTestId("send-hero-amount-primary"))
    await settle()
    expect(mockSavePreferredAmountCurrency).toHaveBeenLastCalledWith(
      PreferredAmountCurrency.Display,
    )
    expect(heroLines()[0]).toMatch(/^₦/)
  })

  it("leads a fixed amount with the display currency whatever the sender last typed in", async () => {
    mockPreferredAmountCurrency.current = PreferredAmountCurrency.Default
    renderScreen(invoiceDestination)
    await settle()

    const [primary, secondary] = heroLines()
    expect(primary).toMatch(/^₦/)
    expect(secondary).toBe("1,000 SAT")
  })
})

/**
 * The balance line is in the wallet's own currency; a second line, in the display currency,
 * shows only when that differs. A dollar wallet with USD as the display currency is therefore
 * one line, centred in a card that keeps its two-line height.
 */
describe("screen reader focus on open", () => {
  // react-native's jest mocks: no screen reader by default, and no focus sent.
  const isScreenReaderEnabled = jest.mocked(AccessibilityInfo.isScreenReaderEnabled)
  const sendAccessibilityEvent = jest.mocked(AccessibilityInfo.sendAccessibilityEvent)

  beforeEach(() => {
    isScreenReaderEnabled.mockResolvedValue(true)
    sendAccessibilityEvent.mockClear()
  })

  afterAll(() => {
    isScreenReaderEnabled.mockResolvedValue(false)
  })

  /** The test ID of each native node screen reader focus was sent to. */
  const focusedTestIds = () =>
    sendAccessibilityEvent.mock.calls.map(
      ([node, event]) =>
        event === "focus" &&
        (node as unknown as { props: { testID?: string } }).props.testID,
    )

  const passFocusDelay = () =>
    act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, INITIAL_FOCUS_DELAY_MS + 50)
        }),
    )

  it("lands on the keypad while there is no amount yet", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    await passFocusDelay()

    expect(focusedTestIds()).toEqual(["Key 1"])
  })

  it("stays on the keypad when the sender types before the delay ends", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("1")
    await passFocusDelay()

    expect(focusedTestIds()).toEqual(["Key 1"])
  })

  it("lands on Next when the invoice fixes the amount", async () => {
    renderScreen(invoiceDestination)
    await settle()
    await passFocusDelay()

    expect(focusedTestIds()).toEqual([LL.common.next()])
  })
})

describe("wallet summary balance lines", () => {
  const secondLine = () => screen.queryByTestId("send-wallet-balance-secondary")

  const switchToDollar = async () => {
    fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))
    await settle()
    expect(screen.getByTestId(`${WalletCurrency.Usd} Wallet Balance`)).toBeTruthy()
  }

  it("shows bitcoin as sats over its display-currency value", async () => {
    mockDisplayCurrency.current = "USD"
    renderScreen(intraledgerDestination())
    await settle()

    expect(
      within(screen.getByTestId(`${WalletCurrency.Btc} Wallet Balance`)).getByText(/SAT/),
    ).toBeTruthy()
    expect(within(secondLine()!).getByText(/^~ \$/)).toBeTruthy()
  })

  it("shows the dollar wallet as one line when the display currency is USD", async () => {
    mockDisplayCurrency.current = "USD"
    renderScreen(intraledgerDestination())
    await settle()

    await switchToDollar()

    expect(secondLine()).toBeNull()
  })

  it("adds the display-currency value under the dollar balance otherwise", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    await switchToDollar()

    expect(within(secondLine()!).getByText(/^~ ₦/)).toBeTruthy()
  })
})

/**
 * The summary replaced the choose-wallet picker, the one place hide-balance let the send
 * flow reveal an amount (#4125), so it keeps the picker's rule rather than the old inline
 * field's mask: the balance is what the user switches wallets by.
 */
describe("wallet summary under hide-balance", () => {
  const expectBalanceShown = () =>
    expect(
      within(screen.getByTestId(`${WalletCurrency.Btc} Wallet Balance`)).getAllByText(
        /\d/,
      ).length,
    ).toBeGreaterThan(0)

  it("shows the balance when balances are visible", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    expectBalanceShown()
  })

  it("still shows the balance while hide-balance is on", async () => {
    renderScreen(intraledgerDestination(), { hideAmount: true })
    await settle()
    expectBalanceShown()
  })
})

/** The note is the screen's only text field, so these drive the keyboard listeners the
 *  way typing a note would: will events for iOS, did events for Android. */
describe("while the note is typed", () => {
  const keyboardListeners: Record<string, Array<() => void>> = {}
  const emitKeyboard = (event: string) =>
    act(() => (keyboardListeners[event] ?? []).forEach((listener) => listener()))
  const showKeyboard = () => {
    emitKeyboard("keyboardWillShow")
    emitKeyboard("keyboardDidShow")
  }
  const hideKeyboard = () => {
    emitKeyboard("keyboardWillHide")
    emitKeyboard("keyboardDidHide")
  }

  beforeEach(() => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(false)
    jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
      ;(keyboardListeners[event] ??= []).push(listener as () => void)
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.keys(keyboardListeners).forEach((event) => delete keyboardListeners[event])
    mockIsIos.current = true
  })

  const screenProps = () => screen.UNSAFE_getByType(Screen).props
  const scrollView = () =>
    screen
      .UNSAFE_getAllByType(ScrollView)
      .find((node) => node.props.keyboardShouldPersistTaps === "handled")!

  it("hands the keypad's place to the system keyboard, and takes it back", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    showKeyboard()
    expect(screen.queryByTestId("Key 1")).toBeNull()
    expect(nextButton()).toBeTruthy()

    hideKeyboard()
    expect(screen.getByTestId("Key 1")).toBeTruthy()
  })

  /** Android reports a closed keyboard as a keyboard change, which left a stale lift. */
  it("lifts the screen on Android only while the keyboard is up", async () => {
    mockIsIos.current = false
    renderScreen(intraledgerDestination())
    await settle()
    expect(screenProps().avoidKeyboardOnAndroid).toBe(true)
    expect(screenProps().avoidKeyboardEnabled).toBe(false)

    showKeyboard()
    expect(screenProps().avoidKeyboardEnabled).toBe(true)

    hideKeyboard()
    expect(screenProps().avoidKeyboardEnabled).toBe(false)
  })

  /** iOS settles back by itself and needs the lift on as the keyboard starts to move. */
  it("keeps the lift on for iOS", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    expect(screenProps().avoidKeyboardEnabled).toBe(true)
    showKeyboard()
    hideKeyboard()
    expect(screenProps().avoidKeyboardEnabled).toBe(true)
  })

  it("drops the bottom inset the keyboard covers", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    expect(screenProps().edges).toEqual(["left", "right", "bottom"])

    showKeyboard()
    expect(screenProps().edges).toEqual(["left", "right"])

    hideKeyboard()
    expect(screenProps().edges).toEqual(["left", "right", "bottom"])
  })

  it("scrolls to the note as the screen shrinks and the note grows", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    const scrollToEnd = scrollView().instance.scrollToEnd as jest.Mock
    scrollToEnd.mockClear()

    fireEvent(scrollView(), "layout", { nativeEvent: { layout: { height: 600 } } })
    expect(scrollToEnd).not.toHaveBeenCalled()

    showKeyboard()
    fireEvent(scrollView(), "layout", { nativeEvent: { layout: { height: 300 } } })
    fireEvent(scrollView(), "contentSizeChange", 360, 520)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })

  /** A fixed amount has no keypad to hand over, but the note still rides the keyboard. */
  it("keeps the note in view for a fixed amount too", async () => {
    renderScreen(invoiceDestination)
    await settle()
    const scrollToEnd = scrollView().instance.scrollToEnd as jest.Mock
    scrollToEnd.mockClear()

    showKeyboard()
    fireEvent(scrollView(), "layout", { nativeEvent: { layout: { height: 300 } } })

    expect(screenProps().avoidKeyboardEnabled).toBe(true)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(within(nextButton()).getByText(LL.common.next())).toBeTruthy()
  })
})
