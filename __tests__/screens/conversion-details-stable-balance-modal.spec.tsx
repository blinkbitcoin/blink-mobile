import React from "react"
import {
  Text,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { render, waitFor, fireEvent, act } from "@testing-library/react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { ThemeProvider } from "@rn-vui/themed"

import { ConversionDetailsScreen } from "@app/screens/conversion-flow/conversion-details-screen"
import {
  WalletCurrency,
  ConversionScreenDocument,
  RealtimePriceDocument,
  RealtimePriceUnauthedDocument,
  DisplayCurrencyDocument,
  CurrencyListDocument,
} from "@app/graphql/generated"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { createCache } from "@app/graphql/cache"

const mockUseActiveWallet = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockMarkAsShown = jest.fn()
const mockUseStableBalanceFirstTime = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/hooks/use-stable-balance-first-time", () => ({
  useStableBalanceFirstTime: () => mockUseStableBalanceFirstTime(),
}))

jest.mock("@app/components/stable-balance-first-time-modal", () => ({
  StableBalanceFirstTimeModal: ({
    isVisible,
    onAcknowledge,
  }: {
    isVisible: boolean
    onAcknowledge: () => void
  }) => {
    const ReactMock = jest.requireActual("react") as typeof React
    if (!isVisible) return null
    return ReactMock.createElement(
      "View",
      { testID: "stable-balance-first-time-modal" },
      ReactMock.createElement(
        "Text",
        { testID: "stable-balance-first-time-ack", onPress: onAcknowledge },
        "I understand",
      ),
    )
  },
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

const scWallets = [
  {
    id: "sc-btc-wallet",
    walletCurrency: WalletCurrency.Btc,
    balance: { amount: 100000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    transactions: [],
  },
  {
    id: "sc-usd-wallet",
    walletCurrency: WalletCurrency.Usd,
    balance: { amount: 50000, currency: WalletCurrency.Usd, currencyCode: "USD" },
    transactions: [],
  },
]

const createMocks = (): MockedResponse[] => {
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
                balance: 100000,
                walletCurrency: WalletCurrency.Btc,
              },
              {
                __typename: "UsdWallet",
                id: "usd-wallet-id",
                balance: 50000,
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
              denominatorCurrency: "USD",
              btcSatPrice: {
                __typename: "PriceOfOneSatInMinorUnit",
                base: 2200000000,
                offset: 12,
              },
              usdCentPrice: {
                __typename: "PriceOfOneUsdCentInMinorUnit",
                base: 100000000,
                offset: 6,
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
            displayCurrency: "USD",
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
        ],
      },
    },
  }

  const realtimePriceUnauthedMock = {
    request: {
      query: RealtimePriceUnauthedDocument,
      variables: { currency: "USD" },
    },
    result: { data: { __typename: "Query", realtimePrice: null } },
  }

  return [
    conversionScreenMock,
    realtimePriceMock,
    realtimePriceUnauthedMock,
    displayCurrencyMock,
    currencyListMock,
    conversionScreenMock,
    realtimePriceMock,
    realtimePriceUnauthedMock,
    displayCurrencyMock,
    currencyListMock,
  ]
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

const originalConsoleError = console.error
let consoleErrorSpy: jest.SpyInstance | null = null

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
  mockUseStableBalanceFirstTime.mockReturnValue({
    shouldShow: true,
    markAsShown: mockMarkAsShown,
    loaded: true,
  })
})

describe("ConversionDetailsScreen — first-time stable balance modal", () => {
  it("renders the first-time modal when self-custodial AND stable balance is active", async () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true, wallets: scWallets })
    mockUseSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })

    const Wrapper = createTestWrapper(createMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("stable-balance-first-time-modal")).toBeTruthy()
    })
  })

  it("does not render the modal for custodial users", async () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false, wallets: [] })
    mockUseSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })

    const Wrapper = createTestWrapper(createMocks())

    const { queryByTestId, getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(queryByTestId("stable-balance-first-time-modal")).toBeNull()
  })

  it("does not render the modal when stable balance is not active", async () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true, wallets: scWallets })
    mockUseSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })

    const Wrapper = createTestWrapper(createMocks())

    const { queryByTestId, getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(queryByTestId("stable-balance-first-time-modal")).toBeNull()
  })

  it("does not render the modal once the user has already acknowledged it", async () => {
    mockUseStableBalanceFirstTime.mockReturnValue({
      shouldShow: false,
      markAsShown: mockMarkAsShown,
      loaded: true,
    })
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true, wallets: scWallets })
    mockUseSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })

    const Wrapper = createTestWrapper(createMocks())

    const { queryByTestId, getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(getByTestId("wallet-toggle-button")).toBeTruthy()
    })

    expect(queryByTestId("stable-balance-first-time-modal")).toBeNull()
  })

  it("calls markAsShown when the user acknowledges the modal", async () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true, wallets: scWallets })
    mockUseSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })

    const Wrapper = createTestWrapper(createMocks())

    const { getByTestId } = render(
      <Wrapper>
        <ConversionDetailsScreen />
      </Wrapper>,
    )

    const ackButton = await waitFor(() => getByTestId("stable-balance-first-time-ack"))

    await act(async () => {
      fireEvent.press(ackButton)
    })

    expect(mockMarkAsShown).toHaveBeenCalledTimes(1)
  })
})
