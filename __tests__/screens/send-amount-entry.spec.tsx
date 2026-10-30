import React from "react"
import { Keyboard, ScrollView, StyleSheet } from "react-native"

import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { Screen } from "@app/components/screen"
import { PreferredAmountCurrency } from "@app/graphql/client-only-query"
import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  PaymentDestination,
  ResolvedIntraledgerPaymentDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import {
  createAmountLightningPaymentDetails,
  createIntraledgerPaymentDetails,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  ZeroBtcMoneyAmount,
} from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
}))

const mockHapticReject = jest.fn()

jest.mock("@app/utils/haptics", () => {
  const actual = jest.requireActual("@app/utils/haptics")
  return { ...actual, haptics: { ...actual.haptics, reject: () => mockHapticReject() } }
})

/** Laid over the real fee options, so a spec can stand in a fee error the quote returned. */
const mockFeeTierOverride: { current: Record<string, unknown> } = { current: {} }

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options", () => {
  const actual = jest.requireActual(
    "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options",
  )
  return {
    ...actual,
    useOnchainFeeTierOptions: (...args: unknown[]) => ({
      ...actual.useOnchainFeeTierOptions(...args),
      ...mockFeeTierOverride.current,
    }),
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
    usePriceConversion: () =>
      mockDisplayCurrency.current === "USD" ? usdConverters : actual.usePriceConversion(),
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
    isSelfCustodial: false,
  }),
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
  mockSavePreferredAmountCurrency.mockClear()
  mockNavigate.mockClear()
  mockFeeTierOverride.current = {}
  mockHapticReject.mockClear()
  mockDisplayCurrency.current = "NGN"
  mockPreferredAmountCurrency.current = undefined
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

const renderScreen = (
  paymentDestination: PaymentDestination,
  { hideAmount = false }: { hideAmount?: boolean } = {},
) =>
  render(
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
    </ContextForScreen>,
  )

const settle = async () => {
  await flushAsync()
  await flushAsync()
}

const nextButton = () => screen.getByTestId(LL.common.next())
const isNextDisabled = () => nextButton().props.accessibilityState?.disabled

const typeKeys = (...keys: string[]) =>
  keys.forEach((key) => fireEvent.press(screen.getByTestId(`Key ${key}`)))

describe("free amount", () => {
  it("opens with the keypad, the percent chips and a disabled Add amount", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    expect(screen.getByTestId("Key 1")).toBeTruthy()
    expect(screen.getByTestId("send-25%")).toBeTruthy()
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

  it("sets the chip's share of the selected wallet's balance", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    fireEvent.press(screen.getByTestId("send-50%"))
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: Math.floor(btcWallet.balance / 2), currency: "BTC", currencyCode: "BTC" },
      false,
    )
    expect(isNextDisabled()).toBe(false)
  })

  it("sends the whole balance as a send-all where the rail supports one", async () => {
    renderScreen(intraledgerDestination({ canSendMax: true }))
    await settle()

    fireEvent.press(screen.getByTestId("send-100%"))
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: btcWallet.balance, currency: "BTC", currencyCode: "BTC" },
      true,
    )
  })

  it("sends 100% as a plain amount where the rail has no send-all", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    fireEvent.press(screen.getByTestId("send-100%"))
    await settle()

    expect(mockSetAmount).toHaveBeenLastCalledWith(
      { amount: btcWallet.balance, currency: "BTC", currencyCode: "BTC" },
      false,
    )
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
})

/**
 * The SDK calls an on-chain amount too low until the sender has typed past the minimum, so
 * that error waits for Next rather than flagging each keystroke on the way there.
 */
describe("an amount the fee quote calls too low", () => {
  const tooLow = LL.SendBitcoinScreen.sdkAmountTooLow()

  beforeEach(() => {
    mockFeeTierOverride.current = {
      feeTierErrorMessage: tooLow,
      isFeeTierErrorBlocking: true,
      isFeeTierErrorDeferred: true,
    }
  })

  it("stays quiet while the amount is typed, with Next on", async () => {
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("3")
    await settle()

    expect(screen.queryByText(tooLow)).toBeNull()
    expect(isNextDisabled()).toBe(false)
    expect(mockHapticReject).not.toHaveBeenCalled()
  })

  /** The light refusal of an amount fixed in place, like Low funds: once per showing. */
  it("buzzes a refusal each time Next shows it", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    typeKeys("1")
    await settle()

    fireEvent.press(nextButton())
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    typeKeys("0")
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(1)

    fireEvent.press(nextButton())
    await settle()
    expect(mockHapticReject).toHaveBeenCalledTimes(2)
  })

  it("says so on Next, holds the send, and turns Next off for that amount", async () => {
    renderScreen(intraledgerDestination())
    await settle()
    typeKeys("3")
    await settle()

    fireEvent.press(nextButton())
    await settle()

    expect(screen.getByText(tooLow)).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(isNextDisabled()).toBe(true)
  })

  /** ₦10 stays inside the bitcoin balance, so Next answers to the fee error alone. */
  it("goes quiet again once the amount changes", async () => {
    renderScreen(intraledgerDestination())
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

  /** Every other self-custodial fee error still shows at once: no amount typed further on
   *  fixes a network failure or a balance that cannot cover the fee. */
  it("shows a fee error that is not deferred straight away", async () => {
    mockFeeTierOverride.current = {
      feeTierErrorMessage: LL.SendBitcoinScreen.sdkNetworkError(),
      isFeeTierErrorBlocking: true,
      isFeeTierErrorDeferred: false,
    }
    renderScreen(intraledgerDestination())
    await settle()

    typeKeys("3")
    await settle()

    expect(screen.getByText(LL.SendBitcoinScreen.sdkNetworkError())).toBeTruthy()
    expect(isNextDisabled()).toBe(true)
  })
})

describe("fixed amount", () => {
  it("hides the keypad and chips and offers Next straight away", async () => {
    renderScreen(invoiceDestination)
    await settle()

    expect(screen.queryByTestId("Key 1")).toBeNull()
    expect(screen.queryByTestId("send-25%")).toBeNull()
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
 * field's mask: the balance is what the user switches wallets and picks a percentage by.
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
    expect(screen.queryByTestId("send-25%")).toBeNull()
    expect(nextButton()).toBeTruthy()

    hideKeyboard()
    expect(screen.getByTestId("Key 1")).toBeTruthy()
    expect(screen.getByTestId("send-25%")).toBeTruthy()
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
