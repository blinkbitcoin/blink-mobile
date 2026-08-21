import React from "react"
import { TouchableWithoutFeedback } from "react-native"

import { act, render, screen, waitFor, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  PaymentDestination,
  ResolvedIntraledgerPaymentDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { createIntraledgerPaymentDetails } from "@app/screens/send-bitcoin-screen/payment-details"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
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
  // Only the consumer hook is stubbed: the shared screen wrapper builds its
  // settled registry from this module's context and value builder, so replacing
  // the module wholesale would leave it without either.
  ...jest.requireActual("@app/hooks/use-account-registry"),
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

// Inline intraledger destination, mirroring send-details.spec.tsx (the
// storybook stories this previously rendered were removed with storybook).
const intraledgerWalletId = "f79792e3-282b-45d4-85d5-7486d020def5"
const intraledgerHandle = "test"

const intraledgerValidDestination: ResolvedIntraledgerPaymentDestination = {
  valid: true,
  walletId: intraledgerWalletId,
  paymentType: PaymentType.Intraledger,
  handle: intraledgerHandle,
}

const createIntraledgerPaymentDetail = <T extends WalletCurrency>({
  convertMoneyAmount,
  sendingWalletDescriptor,
}: CreatePaymentDetailParams<T>) =>
  createIntraledgerPaymentDetails({
    handle: intraledgerHandle,
    recipientWalletId: intraledgerWalletId,
    sendingWalletDescriptor,
    convertMoneyAmount,
    unitOfAccountAmount: ZeroBtcMoneyAmount,
  })

const intraledgerPaymentDestination: PaymentDestination = {
  valid: true,
  validDestination: intraledgerValidDestination,
  destinationDirection: DestinationDirection.Send,
  createPaymentDetail: createIntraledgerPaymentDetail,
}

const intraledgerRoute = {
  key: "sendBitcoinDetailsScreen",
  name: "sendBitcoinDetails",
  params: {
    paymentDestination: intraledgerPaymentDestination,
  },
} as const

const Intraledger = () => <SendBitcoinDetailsScreen route={intraledgerRoute} />

describe("choose-wallet modal respects hide-balance", () => {
  const renderScreen = (hideAmount: boolean) =>
    render(
      <ContextForScreen>
        <HideAmountContextProvider value={{ hideAmount, toggleHideAmount: jest.fn() }}>
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
