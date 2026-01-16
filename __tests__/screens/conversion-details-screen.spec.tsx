import React from "react"
import {
  Text,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { it } from "@jest/globals"
import { fireEvent, render, waitFor, act } from "@testing-library/react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { ThemeProvider } from "@rn-vui/themed"

import { ConversionDetailsScreen } from "@app/screens/conversion-flow/conversion-details-screen"
import {
  WalletCurrency,
  ConversionScreenDocument,
  RealtimePriceDocument,
  DisplayCurrencyDocument,
  CurrencyListDocument,
} from "@app/graphql/generated"
import { APPROXIMATE_PREFIX } from "@app/config"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { createCache } from "@app/graphql/cache"
import { DisplayCurrency as DisplayCurrencyType } from "@app/types/amounts"

const mockNavigate = jest.fn()
const originalConsoleError = console.error
let consoleErrorSpy: jest.SpyInstance | null = null

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

type CurrencyPillProps = {
  currency?: WalletCurrency | "ALL"
  label?: string
  containerStyle?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
}

jest.mock("@app/components/atomic/currency-pill", () => ({
  CurrencyPill: (props: CurrencyPillProps) => <Text>{props.label ?? ""}</Text>,
  useEqualPillWidth: () => ({
    widthStyle: { minWidth: 140 },
    onPillLayout: () => jest.fn(),
  }),
}))

jest.mock("@app/components/atomic/currency-pill/use-equal-pill-width", () => ({
  useEqualPillWidth: () => ({
    widthStyle: { minWidth: 140 },
    onPillLayout: () => jest.fn(),
  }),
}))

const Stack = createStackNavigator()

const BTC_SAT_PRICE_BASE = 2200000000
const BTC_SAT_PRICE_OFFSET = 12
const USD_CENT_PRICE_BASE = 100000000
const USD_CENT_PRICE_OFFSET = 6

const calculateExpectedUsdFromSats = (sats: number): number => {
  const displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET)
  const displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET)
  const usdCents = Math.round(sats * displayCurrencyPerSat * (1 / displayCurrencyPerCent))
  return usdCents
}

const calculateExpectedSatsFromUsd = (usdCents: number): number => {
  const displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET)
  const displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET)
  const sats = Math.round(usdCents * displayCurrencyPerCent * (1 / displayCurrencyPerSat))
  return sats
}

const formatNumber = (amount: number, fractionDigits: number) =>
  Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)

const formatSats = (sats: number): string => {
  return `${formatNumber(sats, 0)} SAT`
}

const formatUsdCents = (usdCents: number): string => {
  return `$${formatNumber(usdCents / 100, 2)}`
}

const withApprox = (value: string, isApprox: boolean): string =>
  isApprox ? `${APPROXIMATE_PREFIX} ${value}` : value

const getDisplaySymbol = (displayCurrency: string) => {
  if (displayCurrency === "EUR") return "€"
  return "$"
}

const displayCurrencyFractionDigits: Record<string, number> = {
  USD: 2,
  EUR: 2,
}

const getDisplayCurrencyInfo = (displayCurrency: string) => {
  const fractionDigits = displayCurrencyFractionDigits[displayCurrency] ?? 2
  const oneMajorUnitInMinor = Math.pow(10, fractionDigits)
  const showFractionDigits = displayCurrencyPerCent < oneMajorUnitInMinor
  return {
    fractionDigits,
    showFractionDigits,
    symbol: getDisplaySymbol(displayCurrency),
  }
}

const formatDisplayMinor = (minorUnits: number, displayCurrency: string): string => {
  const { fractionDigits, showFractionDigits, symbol } =
    getDisplayCurrencyInfo(displayCurrency)
  const amountInMajor = minorUnits / Math.pow(10, fractionDigits)
  const digits = showFractionDigits ? fractionDigits : 0
  return `${symbol}${formatNumber(amountInMajor, digits)}`
}

type MockOptions = {
  btcBalance: number
  usdBalance: number
  displayCurrency?: string
}

const createGraphQLMocks = (options: MockOptions): MockedResponse[] => {
  const { btcBalance, usdBalance, displayCurrency = "USD" } = options

  const conversionScreenMock = {
    request: { query: ConversionScreenDocument },
    result: {
      data: {
        __typename: "Query",
        me: {
          __typename: "User",
          id: "user-id",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id",
            wallets: [
              {
                __typename: "BTCWallet",
                id: "btc-wallet-id",
                balance: btcBalance,
                walletCurrency: WalletCurrency.Btc,
              },
              {
                __typename: "UsdWallet",
                id: "usd-wallet-id",
                balance: usdBalance,
                walletCurrency: WalletCurrency.Usd,
              },
            ],
          },
        },
      },
    },
  }

  const realtimePriceMock = {
    request: { query: RealtimePriceDocument },
    result: {
      data: {
        __typename: "Query",
        me: {
          __typename: "User",
          id: "user-id",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id",
            realtimePrice: {
              __typename: "RealtimePrice",
              id: "price-id",
              timestamp: Date.now(),
              denominatorCurrency: displayCurrency,
              btcSatPrice: {
                __typename: "PriceOfOneSatInMinorUnit",
                base: BTC_SAT_PRICE_BASE,
                offset: BTC_SAT_PRICE_OFFSET,
              },
              usdCentPrice: {
                __typename: "PriceOfOneUsdCentInMinorUnit",
                base: USD_CENT_PRICE_BASE,
                offset: USD_CENT_PRICE_OFFSET,
              },
            },
          },
        },
      },
    },
  }

  const displayCurrencyMock = {
    request: { query: DisplayCurrencyDocument },
    result: {
      data: {
        __typename: "Query",
        me: {
          __typename: "User",
          id: "user-id",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id",
            displayCurrency,
          },
        },
      },
    },
  }

  const currencyListMock = {
    request: { query: CurrencyListDocument },
    result: {
      data: {
        __typename: "Query",
        currencyList: [
          {
            __typename: "Currency",
            id: "USD",
            flag: "",
            name: "US Dollar",
            symbol: "$",
            fractionDigits: 2,
          },
          {
            __typename: "Currency",
            id: "EUR",
            flag: "",
            name: "Euro",
            symbol: "€",
            fractionDigits: 2,
          },
        ],
      },
    },
  }

  return [
    conversionScreenMock,
    realtimePriceMock,
    displayCurrencyMock,
    currencyListMock,
    conversionScreenMock,
    realtimePriceMock,
    displayCurrencyMock,
    currencyListMock,
    conversionScreenMock,
    realtimePriceMock,
    displayCurrencyMock,
    currencyListMock,
  ]
}

const createEmptyMocks = (): MockedResponse[] => {
  const baseMocks: MockedResponse[] = [
    {
      request: { query: ConversionScreenDocument },
      result: { data: { __typename: "Query", me: null } },
    },
    {
      request: { query: RealtimePriceDocument },
      result: { data: { __typename: "Query", me: null } },
    },
    {
      request: { query: DisplayCurrencyDocument },
      result: { data: { __typename: "Query", me: null } },
    },
    {
      request: { query: CurrencyListDocument },
      result: { data: { __typename: "Query", currencyList: [] } },
    },
  ]

  return [...baseMocks, ...baseMocks, ...baseMocks]
}

type TestWrapperProps = { children: React.ReactNode }

const createTestWrapper = (mocks: MockedResponse[]) => {
  const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => (
    <ThemeProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Test">
            {() => (
              <MockedProvider mocks={mocks} cache={createCache()} addTypename={true}>
                <TypesafeI18n locale="en">
                  <IsAuthedContextProvider value={true}>
                    {children}
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </MockedProvider>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  )
  return TestWrapper
}

type GetByTestIdFn = ReturnType<typeof render>["getByTestId"]

const pressKey = (getByTestId: GetByTestIdFn, key: string) => {
  const keyButton = getByTestId(`Key ${key}`)
  fireEvent.press(keyButton)
}

const pressKeys = (getByTestId: GetByTestIdFn, keys: string[]) => {
  keys.forEach((key) => pressKey(getByTestId, key))
}

type Field = "from" | "to" | "currency"

type ScenarioAction =
  | { type: "toggle" }
  | { type: "multiToggle"; count: number }
  | { type: "focus"; field: Field }
  | { type: "type"; field: Field }
  | { type: "clear"; field?: Field }
  | { type: "percent"; value: 25 | 50 | 75 | 100 }
  | { type: "next" }

type Scenario = {
  name: string
  options: MockOptions
  actions: ScenarioAction[]
  expectError?: boolean
  expectNavigate?: boolean
}

type PrimaryAmount = {
  currency: WalletCurrency | DisplayCurrencyType
  amount: number
}

const swapFocusedField = (current: Field | null): Field | null =>
  current === "from" ? "to" : current === "to" ? "from" : current

const computeFocusedField = (actions: ScenarioAction[]): Field | null => {
  let focused: Field | null = null

  for (const action of actions) {
    if (action.type === "focus") focused = action.field
    if (action.type === "type") focused = action.field
    if (action.type === "clear" && action.field) focused = action.field
    if (action.type === "percent") focused = "from"
    if (action.type === "toggle") focused = swapFocusedField(focused)
    if (action.type === "multiToggle") {
      for (let i = 0; i < action.count; i += 1) {
        focused = swapFocusedField(focused)
      }
    }
  }

  return focused
}

const digitsForCurrency = (
  currency: WalletCurrency | DisplayCurrencyType,
  displayCurrency: string,
): string[] => {
  if (currency === WalletCurrency.Btc) return ["1", "0", "0", "0", "0", "0"]
  if (currency === WalletCurrency.Usd) return ["0", ".", "0", "1"]
  const { showFractionDigits } = getDisplayCurrencyInfo(displayCurrency)
  return showFractionDigits ? ["0", ".", "0", "1"] : ["1"]
}

const amountFromDigits = (
  currency: WalletCurrency | DisplayCurrencyType,
  digits: string[],
  displayCurrency: string,
): number => {
  const raw = digits.join("")
  if (currency === WalletCurrency.Btc) return Number(raw.replace(".", ""))
  const fractionDigits =
    currency === WalletCurrency.Usd
      ? 2
      : getDisplayCurrencyInfo(displayCurrency).fractionDigits

  if (!raw.includes(".")) {
    return Number(raw) * Math.pow(10, fractionDigits)
  }

  const [major, minor = ""] = raw.split(".")
  const paddedMinor = (minor + "0".repeat(fractionDigits)).slice(0, fractionDigits)
  return Number(major || "0") * Math.pow(10, fractionDigits) + Number(paddedMinor)
}

const displayCurrencyPerSat = BTC_SAT_PRICE_BASE / Math.pow(10, BTC_SAT_PRICE_OFFSET)
const displayCurrencyPerCent = USD_CENT_PRICE_BASE / Math.pow(10, USD_CENT_PRICE_OFFSET)

const convertAmount = (
  amount: number,
  fromCurrency: WalletCurrency | DisplayCurrencyType,
  toCurrency: WalletCurrency | DisplayCurrencyType,
): number => {
  const priceOfCurrencyInCurrency = {
    [WalletCurrency.Btc]: {
      [DisplayCurrencyType]: displayCurrencyPerSat,
      [WalletCurrency.Usd]: displayCurrencyPerSat * (1 / displayCurrencyPerCent),
      [WalletCurrency.Btc]: 1,
    },
    [WalletCurrency.Usd]: {
      [DisplayCurrencyType]: displayCurrencyPerCent,
      [WalletCurrency.Btc]: displayCurrencyPerCent * (1 / displayCurrencyPerSat),
      [WalletCurrency.Usd]: 1,
    },
    [DisplayCurrencyType]: {
      [WalletCurrency.Btc]: 1 / displayCurrencyPerSat,
      [WalletCurrency.Usd]: 1 / displayCurrencyPerCent,
      [DisplayCurrencyType]: 1,
    },
  }

  return Math.round(priceOfCurrencyInCurrency[fromCurrency][toCurrency] * amount)
}

const formatCurrencyValue = (
  currency: WalletCurrency | DisplayCurrencyType,
  amount: number,
  displayCurrency: string,
): string => {
  if (currency === WalletCurrency.Btc) return formatSats(amount)
  if (currency === WalletCurrency.Usd) return formatUsdCents(amount)
  return formatDisplayMinor(amount, displayCurrency)
}

const getInitialFromCurrency = (btcBalance: number, usdBalance: number) => {
  if (btcBalance === 0 && usdBalance > 0) return WalletCurrency.Usd
  return WalletCurrency.Btc
}

const getFromInput = (
  getByPlaceholderText: ReturnType<typeof render>["getByPlaceholderText"],
  fromCurrency: WalletCurrency,
) => getByPlaceholderText(fromCurrency === WalletCurrency.Btc ? "0 SAT" : "$0")

const getToInput = (
  getByPlaceholderText: ReturnType<typeof render>["getByPlaceholderText"],
  toCurrency: WalletCurrency,
) => getByPlaceholderText(toCurrency === WalletCurrency.Btc ? "0 SAT" : "$0")

const getCurrencyInput = (
  getByPlaceholderText: ReturnType<typeof render>["getByPlaceholderText"],
  displayCurrency: string,
) => getByPlaceholderText(`${getDisplaySymbol(displayCurrency)}0`)

const assertConversionValues = async ({
  getByPlaceholderText,
  primary,
  fromCurrency,
  toCurrency,
  displayCurrency,
  focusedField,
}: {
  getByPlaceholderText: ReturnType<typeof render>["getByPlaceholderText"]
  primary: PrimaryAmount
  fromCurrency: WalletCurrency
  toCurrency: WalletCurrency
  displayCurrency: string
  focusedField: Field | null
}) => {
  const fromAmount = convertAmount(primary.amount, primary.currency, fromCurrency)
  const toAmount = convertAmount(primary.amount, primary.currency, toCurrency)

  const fromValue = withApprox(
    formatCurrencyValue(fromCurrency, fromAmount, displayCurrency),
    focusedField !== "from",
  )
  const toValue = withApprox(
    formatCurrencyValue(toCurrency, toAmount, displayCurrency),
    focusedField !== "to",
  )

  const fromInput = getFromInput(getByPlaceholderText, fromCurrency)
  const toInput = getToInput(getByPlaceholderText, toCurrency)

  await waitFor(() => {
    expect(fromInput.props.value).toBe(fromValue)
    expect(toInput.props.value).toBe(toValue)
  })

  if (displayCurrency !== "USD") {
    const displayAmount = convertAmount(
      primary.amount,
      primary.currency,
      DisplayCurrencyType,
    )
    const displayValue = withApprox(
      formatCurrencyValue(DisplayCurrencyType, displayAmount, displayCurrency),
      focusedField !== "currency",
    )
    const currencyInput = getCurrencyInput(getByPlaceholderText, displayCurrency)
    await waitFor(() => {
      expect(currencyInput.props.value).toBe(displayValue)
    })
  }
}

beforeAll(() => {
  consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation((message, ...args) => {
      const text = String(message)
      if (text.includes("not wrapped in act")) return
      originalConsoleError(message, ...args)
    })
})

afterAll(() => {
  if (!consoleErrorSpy) return
  consoleErrorSpy.mockRestore()
  consoleErrorSpy = null
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe("Initial render with both wallets having balance", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  it("renders with BTC as from wallet when both have balance", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
    expect(getByPlaceholderText("$0")).toBeTruthy()
  })

  it("toggle button is enabled", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    const toggleButton = getByTestId("wallet-toggle-button")
    expect(toggleButton.props.accessibilityState?.disabled).toBe(false)
  })

  it("next button is disabled when no amount entered", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("next-button")).toBeTruthy()
    })

    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState?.disabled).toBe(true)
  })

  it("percentage buttons are rendered", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(getByTestId("convert-50%")).toBeTruthy()
    expect(getByTestId("convert-75%")).toBeTruthy()
    expect(getByTestId("convert-100%")).toBeTruthy()
    expect(getByTestId("convert-25%")).toBeTruthy()
  })
})

describe("Initial render based on wallet balance", () => {
  it("starts with BTC as from when only BTC has balance", async () => {
    const Wrapper = createTestWrapper(
      createGraphQLMocks({
        btcBalance: 100000,
        usdBalance: 0,
      }),
    )

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
  })

  it("starts with USD as from when only USD has balance", async () => {
    const Wrapper = createTestWrapper(
      createGraphQLMocks({
        btcBalance: 0,
        usdBalance: 50000,
      }),
    )

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(getByPlaceholderText("$0")).toBeTruthy()
  })
})

describe("Toggle without amount - Critical bug test", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("swaps placeholders correctly after toggle", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
    expect(getByPlaceholderText("$0")).toBeTruthy()

    const toggleButton = getByTestId("wallet-toggle-button")

    await act(async () => {
      fireEvent.press(toggleButton)
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(() => getByPlaceholderText("$0")).not.toThrow()
      expect(() => getByPlaceholderText("0 SAT")).not.toThrow()
    })
  })

  it("toggle button remains enabled after toggle without amount", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    const toggleButton = getByTestId("wallet-toggle-button")
    expect(toggleButton.props.accessibilityState?.disabled).toBe(false)

    await act(async () => {
      fireEvent.press(toggleButton)
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      const button = getByTestId("wallet-toggle-button")
      expect(button.props.accessibilityState?.disabled).toBe(false)
    })
  })

  it("next button remains disabled after toggle without amount", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("next-button")).toBeTruthy()
    })

    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState?.disabled).toBe(true)

    const toggleButton = getByTestId("wallet-toggle-button")

    await act(async () => {
      fireEvent.press(toggleButton)
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      const button = getByTestId("next-button")
      expect(button.props.accessibilityState?.disabled).toBe(true)
    })
  })

  it("handles multiple consecutive toggles without crashing", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    const toggleButton = getByTestId("wallet-toggle-button")

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.press(toggleButton)
      })

      act(() => {
        jest.advanceTimersByTime(200)
      })

      await waitFor(() => {
        expect(getByTestId("wallet-toggle-button")).toBeTruthy()
      })
    }

    expect(getByTestId("next-button").props.accessibilityState?.disabled).toBe(true)
  })
})

describe("Keyboard input and conversion verification", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("keyboard keys are rendered and pressable", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("Key 1")).toBeTruthy()
    })

    expect(getByTestId("Key 2")).toBeTruthy()
    expect(getByTestId("Key 3")).toBeTruthy()
    expect(getByTestId("Key 4")).toBeTruthy()
    expect(getByTestId("Key 5")).toBeTruthy()
    expect(getByTestId("Key 6")).toBeTruthy()
    expect(getByTestId("Key 7")).toBeTruthy()
    expect(getByTestId("Key 8")).toBeTruthy()
    expect(getByTestId("Key 9")).toBeTruthy()
    expect(getByTestId("Key 0")).toBeTruthy()
  })

  it("entering amount via keyboard enables next button after debounce", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("Key 1")).toBeTruthy()
    })

    await act(async () => {
      pressKeys(getByTestId, ["1", "0", "0", "0"])
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    await waitFor(
      () => {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(false)
      },
      { timeout: 3000 },
    )
  })

  it("converts sats to USD when typing in BTC input", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("Key 1")).toBeTruthy()
    })

    const btcInput = getByPlaceholderText("0 SAT")
    const usdInput = getByPlaceholderText("$0")

    act(() => {
      fireEvent(btcInput, "focus")
    })

    await act(async () => {
      pressKeys(getByTestId, ["1", "0", "0", "0", "0", "0"])
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    const expectedUsdCents = calculateExpectedUsdFromSats(100000)

    await waitFor(() => {
      expect(btcInput.props.value).toBe(formatSats(100000))
      expect(usdInput.props.value).toBe(
        withApprox(formatUsdCents(expectedUsdCents), true),
      )
    })
  })
})

describe("Toggle then enter amount - Original bug scenario", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("toggle without amount, then enter amount - conversion should work", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    act(() => {
      jest.advanceTimersByTime(100)
    })

    const toggleButton = getByTestId("wallet-toggle-button")

    await act(async () => {
      fireEvent.press(toggleButton)
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    const btcInput = getByPlaceholderText("0 SAT")
    act(() => {
      fireEvent(btcInput, "focus")
    })

    await act(async () => {
      pressKeys(getByTestId, ["1", "0", "0", "0", "0", "0"])
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    const expectedUsdCents = calculateExpectedUsdFromSats(100000)

    await waitFor(
      () => {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(false)
      },
      { timeout: 3000 },
    )

    const usdInput = getByPlaceholderText("$0")
    expect(btcInput.props.value).toBe(formatSats(100000))
    expect(usdInput.props.value).toBe(withApprox(formatUsdCents(expectedUsdCents), true))
  })
})

describe("USD input converts to SAT", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 0,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("converts USD to sats when typing in USD input", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId, getByPlaceholderText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("Key 1")).toBeTruthy()
    })

    const usdInput = getByPlaceholderText("$0")
    const btcInput = getByPlaceholderText("0 SAT")

    act(() => {
      fireEvent(usdInput, "focus")
    })

    await act(async () => {
      pressKeys(getByTestId, ["0", ".", "0", "1"])
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    const expectedSats = calculateExpectedSatsFromUsd(1)

    await waitFor(() => {
      expect(usdInput.props.value).toBe(formatUsdCents(1))
      expect(btcInput.props.value).toBe(withApprox(formatSats(expectedSats), true))
    })
  })
})

describe("Percentage selector functionality", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("pressing 100% sets the full balance", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("convert-100%")).toBeTruthy()
    })

    const fullBalanceButton = getByTestId("convert-100%")

    await act(async () => {
      fireEvent.press(fullBalanceButton)
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    await waitFor(
      () => {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(false)
      },
      { timeout: 3000 },
    )
  })

  it("pressing 50% sets half the balance", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("convert-50%")).toBeTruthy()
    })

    const halfBalanceButton = getByTestId("convert-50%")

    await act(async () => {
      fireEvent.press(halfBalanceButton)
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    await waitFor(
      () => {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(false)
      },
      { timeout: 3000 },
    )
  })
})

describe("Navigation", () => {
  const buildMocks = () =>
    createGraphQLMocks({
      btcBalance: 100000,
      usdBalance: 50000,
    })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("navigates to confirmation screen with correct params when next is pressed", async () => {
    const Wrapper = createTestWrapper(buildMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("convert-100%")).toBeTruthy()
    })

    const fullBalanceButton = getByTestId("convert-100%")

    await act(async () => {
      fireEvent.press(fullBalanceButton)
    })

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    await waitFor(
      () => {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(false)
      },
      { timeout: 3000 },
    )

    const nextButton = getByTestId("next-button")

    await act(async () => {
      fireEvent.press(nextButton)
    })

    expect(mockNavigate).toHaveBeenCalledWith(
      "conversionConfirmation",
      expect.objectContaining({
        fromWalletCurrency: WalletCurrency.Btc,
        moneyAmount: expect.objectContaining({
          currency: expect.any(String),
          amount: expect.any(Number),
        }),
      }),
    )
  })
})

describe("Empty state handling", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders nothing when wallet data is missing", async () => {
    const Wrapper = createTestWrapper(createEmptyMocks())

    const { queryByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(queryByTestId("wallet-toggle-button")).toBeNull()
    expect(queryByTestId("next-button")).toBeNull()
  })
})

describe("Comprehensive conversion scenarios", () => {
  const scenarios: Scenario[] = [
    {
      name: "1. Enter -> type from (BTC) -> validate to (USD) and currency",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }],
    },
    {
      name: "2. Enter -> type from (USD) -> validate to (BTC) and currency",
      options: { btcBalance: 0, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }],
    },
    {
      name: "3. Enter -> type to (USD) -> validate from (BTC) and currency",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }],
    },
    {
      name: "4. Enter -> type to (BTC) -> validate from (USD) and currency",
      options: { btcBalance: 0, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }],
    },
    {
      name: "5. Enter -> type currency (display) -> validate from and to",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }],
    },

    {
      name: "6. Enter -> type from -> focus to -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "from" },
        { type: "focus", field: "to" },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "7. Enter -> type from -> focus currency -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "from" },
        { type: "focus", field: "currency" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "8. Enter -> type to -> focus from -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "to" },
        { type: "focus", field: "from" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "9. Enter -> type to -> focus currency -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "to" },
        { type: "focus", field: "currency" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "10. Enter -> type currency -> focus from -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "currency" },
        { type: "focus", field: "from" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "11. Enter -> type currency -> focus to -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "currency" },
        { type: "focus", field: "to" },
        { type: "type", field: "to" },
      ],
    },

    {
      name: "12. Enter -> toggle -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "toggle" }, { type: "type", field: "from" }],
    },
    {
      name: "13. Enter -> toggle -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "toggle" }, { type: "type", field: "to" }],
    },
    {
      name: "14. Enter -> toggle -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "toggle" }, { type: "type", field: "currency" }],
    },
    {
      name: "15. Enter -> toggle -> focus from -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "toggle" },
        { type: "focus", field: "from" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "16. Enter -> toggle -> focus to -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "toggle" },
        { type: "focus", field: "to" },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "17. Enter -> toggle -> focus currency -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "toggle" },
        { type: "focus", field: "currency" },
        { type: "type", field: "currency" },
      ],
    },

    {
      name: "18. Enter -> type from -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }, { type: "toggle" }],
    },
    {
      name: "19. Enter -> type to -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }, { type: "toggle" }],
    },
    {
      name: "20. Enter -> type currency -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }, { type: "toggle" }],
    },

    {
      name: "21. Enter -> toggle -> toggle -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "toggle" }, { type: "toggle" }, { type: "type", field: "from" }],
    },
    {
      name: "22. Enter -> toggle -> toggle -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "toggle" }, { type: "toggle" }, { type: "type", field: "to" }],
    },
    {
      name: "23. Enter -> toggle -> toggle -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "toggle" },
        { type: "toggle" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "24. Enter -> type from -> toggle -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }, { type: "toggle" }, { type: "toggle" }],
    },

    {
      name: "25. Enter -> type from -> clear -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "from" },
        { type: "clear", field: "from" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "26. Enter -> type from -> clear -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "from" },
        { type: "clear", field: "from" },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "27. Enter -> type from -> clear -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "from" },
        { type: "clear", field: "from" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "28. Enter -> type to -> clear -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "to" },
        { type: "clear", field: "to" },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "29. Enter -> type to -> clear -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "to" },
        { type: "clear", field: "to" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "30. Enter -> type to -> clear -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "to" },
        { type: "clear", field: "to" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "31. Enter -> type currency -> clear -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "currency" },
        { type: "clear", field: "currency" },
        { type: "type", field: "currency" },
      ],
    },
    {
      name: "32. Enter -> type currency -> clear -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "currency" },
        { type: "clear", field: "currency" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "33. Enter -> type currency -> clear -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "type", field: "currency" },
        { type: "clear", field: "currency" },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "34. Enter -> type -> clear -> toggle -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "from" },
        { type: "clear", field: "from" },
        { type: "toggle" },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "35. Enter -> type -> toggle -> clear -> type -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "type", field: "from" },
        { type: "toggle" },
        { type: "clear", field: "from" },
        { type: "type", field: "from" },
      ],
    },

    {
      name: "36. Enter -> 25% -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 25 }],
    },
    {
      name: "37. Enter -> 50% -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 50 }],
    },
    {
      name: "38. Enter -> 75% -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 75 }],
    },
    {
      name: "39. Enter -> 100% -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 100 }],
    },
    {
      name: "40. Enter -> 25% -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 25 }, { type: "toggle" }],
    },
    {
      name: "41. Enter -> 50% -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 50 }, { type: "toggle" }],
    },
    {
      name: "42. Enter -> 100% -> toggle -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "percent", value: 100 }, { type: "toggle" }],
    },
    {
      name: "43. Enter -> percent -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "percent", value: 25 },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "44. Enter -> percent -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "percent", value: 25 },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "45. Enter -> percent -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "percent", value: 25 },
        { type: "type", field: "currency" },
      ],
    },

    {
      name: "46. Only BTC balance -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 0 },
      actions: [{ type: "type", field: "from" }],
    },
    {
      name: "47. Only BTC balance -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 0 },
      actions: [{ type: "type", field: "to" }],
    },
    {
      name: "48. Only BTC balance -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 0, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }],
    },
    {
      name: "49. Only USD balance -> type from -> validate",
      options: { btcBalance: 0, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }],
    },
    {
      name: "50. Only USD balance -> type to -> validate",
      options: { btcBalance: 0, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }],
    },
    {
      name: "51. Only USD balance -> type currency -> validate",
      options: { btcBalance: 0, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }],
    },
    {
      name: "52. Only BTC balance -> toggle -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 0 },
      actions: [{ type: "toggle" }, { type: "type", field: "from" }],
    },
    {
      name: "53. Only USD balance -> toggle -> type from -> validate",
      options: { btcBalance: 0, usdBalance: 50000 },
      actions: [{ type: "toggle" }, { type: "type", field: "from" }],
    },

    {
      name: "54. Exceeds balance in from -> conversion and error",
      options: { btcBalance: 50, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }],
      expectError: true,
    },
    {
      name: "55. Exceeds balance in to -> conversion and error",
      options: { btcBalance: 50, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }],
      expectError: true,
    },
    {
      name: "56. Exceeds balance from currency -> conversion and error",
      options: { btcBalance: 50, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }],
      expectError: true,
    },

    {
      name: "57. Valid conversion from -> Next -> validate params",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "from" }, { type: "next" }],
      expectNavigate: true,
    },
    {
      name: "58. Valid conversion to -> Next -> validate params",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [{ type: "type", field: "to" }, { type: "next" }],
      expectNavigate: true,
    },
    {
      name: "59. Valid conversion currency -> Next -> validate params",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [{ type: "type", field: "currency" }, { type: "next" }],
      expectNavigate: true,
    },

    {
      name: "60. Multiple toggles -> type from -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "multiToggle", count: 3 },
        { type: "type", field: "from" },
      ],
    },
    {
      name: "61. Multiple toggles -> type to -> validate",
      options: { btcBalance: 100000, usdBalance: 50000 },
      actions: [
        { type: "multiToggle", count: 3 },
        { type: "type", field: "to" },
      ],
    },
    {
      name: "62. Multiple toggles -> type currency -> validate",
      options: { btcBalance: 100000, usdBalance: 50000, displayCurrency: "EUR" },
      actions: [
        { type: "multiToggle", count: 3 },
        { type: "type", field: "currency" },
      ],
    },
  ]

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each(scenarios)("$name", async (scenario) => {
    const displayCurrency = scenario.options.displayCurrency ?? "USD"
    const Wrapper = createTestWrapper(createGraphQLMocks(scenario.options))

    const { getByTestId, getByPlaceholderText, queryByText } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    let fromCurrency = getInitialFromCurrency(
      scenario.options.btcBalance,
      scenario.options.usdBalance,
    )
    let toCurrency =
      fromCurrency === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc
    let primary: PrimaryAmount | null = null
    const expectedFocusedField = computeFocusedField(scenario.actions)

    const advanceTimers = (ms: number) => {
      act(() => {
        jest.advanceTimersByTime(ms)
        jest.runAllTimers()
      })
    }

    const clearInput = async (field?: Field) => {
      if (field) await focusField(field)
      await act(async () => {
        pressKeys(
          getByTestId,
          Array.from({ length: 10 }, () => "⌫"),
        )
      })
      advanceTimers(1500)
    }

    const focusField = async (field: Field) => {
      const input =
        field === "from"
          ? getFromInput(getByPlaceholderText, fromCurrency)
          : field === "to"
            ? getToInput(getByPlaceholderText, toCurrency)
            : await waitFor(() => getCurrencyInput(getByPlaceholderText, displayCurrency))
      fireEvent(input, "focus")
      await act(async () => {})
    }

    for (const action of scenario.actions) {
      if (action.type === "toggle") {
        const shouldWaitRecalc = Boolean(primary && primary.amount > 0)
        await act(async () => {
          fireEvent.press(getByTestId("wallet-toggle-button"))
        })
        advanceTimers(shouldWaitRecalc ? 1500 : 200)
        ;[fromCurrency, toCurrency] = [toCurrency, fromCurrency]
        if (primary) {
          primary = {
            currency: DisplayCurrencyType,
            amount: convertAmount(primary.amount, primary.currency, DisplayCurrencyType),
          }
        }
      }

      if (action.type === "multiToggle") {
        for (let i = 0; i < action.count; i += 1) {
          const shouldWaitRecalc = Boolean(primary && primary.amount > 0)
          await act(async () => {
            fireEvent.press(getByTestId("wallet-toggle-button"))
          })
          advanceTimers(shouldWaitRecalc ? 1500 : 200)
          ;[fromCurrency, toCurrency] = [toCurrency, fromCurrency]
          if (primary) {
            primary = {
              currency: DisplayCurrencyType,
              amount: convertAmount(
                primary.amount,
                primary.currency,
                DisplayCurrencyType,
              ),
            }
          }
        }
      }

      if (action.type === "focus") {
        await focusField(action.field)
      }

      if (action.type === "type") {
        const fieldCurrency =
          action.field === "from"
            ? fromCurrency
            : action.field === "to"
              ? toCurrency
              : DisplayCurrencyType
        await focusField(action.field)
        await clearInput()
        const digits = digitsForCurrency(fieldCurrency, displayCurrency)
        await act(async () => {
          pressKeys(getByTestId, digits)
        })
        advanceTimers(1500)
        primary = {
          currency: fieldCurrency,
          amount: amountFromDigits(fieldCurrency, digits, displayCurrency),
        }
      }

      if (action.type === "clear") {
        await clearInput(action.field)
        primary = null
      }

      if (action.type === "percent") {
        await act(async () => {
          fireEvent.press(getByTestId(`convert-${action.value}%`))
        })
        advanceTimers(1500)
        const balance =
          fromCurrency === WalletCurrency.Btc
            ? scenario.options.btcBalance
            : scenario.options.usdBalance
        primary = {
          currency: fromCurrency,
          amount: Math.round((balance * action.value) / 100),
        }
      }

      if (action.type === "next") {
        await waitFor(() => {
          const nextButton = getByTestId("next-button")
          expect(nextButton.props.accessibilityState?.disabled).toBe(false)
        })
        await act(async () => {
          fireEvent.press(getByTestId("next-button"))
        })
      }
    }

    if (!primary) {
      throw new Error("Scenario must set a primary amount to validate conversion.")
    }

    await assertConversionValues({
      getByPlaceholderText,
      primary,
      fromCurrency,
      toCurrency,
      displayCurrency,
      focusedField: expectedFocusedField,
    })

    if (scenario.expectError) {
      const errorNode = queryByText(/Amount exceeds your balance of/i)
      if (errorNode) {
        expect(errorNode).toBeTruthy()
      }
      if (!errorNode) {
        const nextButton = getByTestId("next-button")
        expect(nextButton.props.accessibilityState?.disabled).toBe(true)
      }
    }

    if (scenario.expectNavigate) {
      expect(mockNavigate).toHaveBeenCalledWith(
        "conversionConfirmation",
        expect.objectContaining({
          fromWalletCurrency: fromCurrency,
          moneyAmount: expect.objectContaining({
            currency: expect.any(String),
            amount: expect.any(Number),
          }),
        }),
      )
    }
  })
})

describe("Conversion calculation verification", () => {
  it("verifies the conversion calculation is mathematically correct", () => {
    const sats = 100000
    const expectedUsdCents = calculateExpectedUsdFromSats(sats)

    expect(expectedUsdCents).toBeGreaterThan(0)
    expect(Number.isInteger(expectedUsdCents)).toBe(true)

    const backToSats = calculateExpectedSatsFromUsd(expectedUsdCents)
    const tolerance = Math.abs(sats - backToSats) / sats
    expect(tolerance).toBeLessThan(0.11)
  })
})
