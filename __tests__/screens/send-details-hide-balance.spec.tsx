import React from "react"
import { TouchableWithoutFeedback } from "react-native"

import { act, render, screen, waitFor, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"

import { Intraledger } from "../../app/screens/send-bitcoin-screen/send-bitcoin-details-screen.stories"
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

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "NGN",
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

// Pin the wallets so the choose-wallet modal is always mounted; MockedProvider
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

// The placeholder renders bare Views without a testID; stub it so the specs
// can query for it.
jest.mock("@app/components/hidden-balance-placeholder/hidden-balance-placeholder", () => {
  const { View } = jest.requireActual("react-native")
  const MockHiddenBalancePlaceholder = () => <View testID="hidden-balance-placeholder" />
  return { HiddenBalancePlaceholder: MockHiddenBalancePlaceholder }
})

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

beforeEach(() => {
  loadLocale("en")
})

describe("choose-wallet modal respects hide-balance", () => {
  const renderScreen = (hideAmount: boolean) =>
    render(
      <ContextForScreen>
        <HideAmountContextProvider
          value={{ hideAmount, switchMemoryHideAmount: jest.fn() }}
        >
          <Intraledger />
        </HideAmountContextProvider>
      </ContextForScreen>,
    )

  const openWalletPicker = async () => {
    await flushAsync()
    await flushAsync()
    // RNTL's fireEvent.press cannot reach TouchableWithoutFeedback's
    // responder-driven onPress, so invoke the handler directly.
    const touchable = screen
      .UNSAFE_getAllByType(TouchableWithoutFeedback)
      .find((t) => t.props.testID === "choose-wallet-to-send-from")
    expect(touchable).toBeTruthy()
    act(() => touchable?.props.onPress())
    await waitFor(() => expect(screen.getByTestId(WalletCurrency.Btc)).toBeTruthy())
  }

  it("shows wallet amounts in the picker when balances are visible", async () => {
    renderScreen(false)
    await openWalletPicker()

    expect(
      within(screen.getByTestId(WalletCurrency.Btc)).getAllByText(/\d/).length,
    ).toBeGreaterThan(0)
    expect(
      within(screen.getByTestId(WalletCurrency.Usd)).getAllByText(/\d/).length,
    ).toBeGreaterThan(0)
    expect(screen.queryAllByTestId("hidden-balance-placeholder")).toHaveLength(0)
  })

  it("does not render wallet amounts in the picker while hidden", async () => {
    renderScreen(true)
    await openWalletPicker()

    // one placeholder in the inline "From" selector + one per modal wallet row
    expect(screen.getAllByTestId("hidden-balance-placeholder")).toHaveLength(3)
    expect(
      within(screen.getByTestId(WalletCurrency.Btc)).queryAllByText(/\d/),
    ).toHaveLength(0)
    expect(
      within(screen.getByTestId(WalletCurrency.Usd)).queryAllByText(/\d/),
    ).toHaveLength(0)
  })
})
