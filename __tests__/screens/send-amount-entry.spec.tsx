import React from "react"
import { StyleSheet } from "react-native"

import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

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

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}))

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
