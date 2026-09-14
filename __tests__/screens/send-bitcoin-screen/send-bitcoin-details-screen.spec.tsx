import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import { SafeAreaProvider } from "react-native-safe-area-context"

import theme from "@app/rne-theme/theme"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"

const mockSendWallets = jest.fn()
const mockCreatePaymentDetail = jest.fn()

const BTC_WALLET = { id: "btc-1", walletCurrency: "BTC", balance: 100000 }
const USD_WALLET = { id: "usd-1", walletCurrency: "USD", balance: 5000 }

/** The wallet list the hook reports before the region has answered: the dollar wallet is
 *  still in it, and still the default, because nothing has withdrawn it yet. */
const PENDING_WALLETS = {
  wallets: [BTC_WALLET, USD_WALLET],
  defaultWallet: USD_WALLET,
  btcWallet: BTC_WALLET,
  usdWallet: USD_WALLET,
  network: "mainnet",
  isSelfCustodial: true,
  loading: true,
}

/** The same account once the verdict lands restricted: the dollar wallet is gone and the
 *  default has fallen back to bitcoin. */
const RESTRICTED_WALLETS = {
  ...PENDING_WALLETS,
  wallets: [BTC_WALLET],
  defaultWallet: BTC_WALLET,
  usdWallet: undefined,
  loading: false,
}

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  useSendWallets: () => mockSendWallets(),
}))

/** Every hook value below is built once, not per render. Handing back a fresh function or
 *  array each time changes the identities the screen's effects depend on, which re-renders
 *  it forever and exhausts the worker rather than failing an assertion. */
const CONVERT_MONEY_AMOUNT = jest.fn((amount: unknown) => amount)
const PRICE_CONVERSION = { convertMoneyAmount: CONVERT_MONEY_AMOUNT }

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => PRICE_CONVERSION,
}))

const DISPLAY_CURRENCY = {
  formatMoneyAmount: () => "$0.00",
  zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
}

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => DISPLAY_CURRENCY,
}))

const LEVEL = { currentLevel: "ONE" }

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => LEVEL,
}))

const HIDE_AMOUNT = { hideAmount: false }

jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: () => HIDE_AMOUNT,
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

const EMPTY_QUERY = { data: undefined }

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useSendBitcoinWithdrawalLimitsQuery: () => EMPTY_QUERY,
  useSendBitcoinInternalLimitsQuery: () => EMPTY_QUERY,
}))

const FEE_TIER_OPTIONS = {
  feeTier: null,
  setFeeTier: jest.fn(),
  feeTierOptions: [],
  feeTierErrorMessage: undefined,
  isFeeTierErrorBlocking: false,
  isQuotingFees: false,
  isOnchain: false,
  selectedTierFee: undefined,
  hasFeeQuote: false,
}

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options", () => ({
  useOnchainFeeTierOptions: () => FEE_TIER_OPTIONS,
}))

const NAVIGATION = { navigate: jest.fn(), setOptions: jest.fn() }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => NAVIGATION,
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}))

const CLIPBOARD = { copyToClipboard: jest.fn() }

jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => CLIPBOARD,
}))

const PERSISTENT_STATE = {
  persistentState: { galoyInstance: { id: "Main" } },
  updateState: jest.fn(),
}

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => PERSISTENT_STATE,
}))

const PILL_WIDTH = { widthStyle: {}, onPillLayout: jest.fn() }

jest.mock("@app/components/atomic/currency-pill/use-equal-pill-width", () => ({
  useEqualPillWidth: () => PILL_WIDTH,
}))

/** The resolved screen renders the whole send form. None of it is what this file asserts,
 *  and rendering it for real is heavy enough to exhaust the worker, so the presentational
 *  pieces stand in as nothing. */
jest.mock("@app/components/amount-input/amount-input", () => ({
  AmountInput: () => null,
}))
jest.mock("@app/components/note-input", () => ({ NoteInput: () => null }))
jest.mock("@app/components/payment-destination-display", () => ({
  PaymentDestinationDisplay: () => null,
}))
jest.mock("@app/screens/send-bitcoin-screen/confirm-fees-modal", () => ({
  ConfirmFeesModal: () => null,
}))
jest.mock("@app/screens/send-bitcoin-screen/send-bitcoin-details-extra-info", () => ({
  SendBitcoinDetailsExtraInfo: () => null,
}))

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    Screen: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, { testID: "screen" }, children),
  }
})

/** Every key is both callable and further nestable, so the screen reaches any depth of copy
 *  without this file mirroring the translation tree. One self-referential proxy rather than a
 *  fresh one per access: handing back a new object each time lets an introspecting caller
 *  allocate forever. */
const LL_STUB: unknown = new Proxy(() => "", { get: () => LL_STUB })
const I18N = { LL: LL_STUB }

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => I18N,
}))

const PENDING_TEST_ID = "send-wallet-list-pending"

const route = {
  params: {
    paymentDestination: { createPaymentDetail: mockCreatePaymentDetail },
  },
} as never

/** The amount sheet reads safe-area insets, so the tree needs a provider with real metrics
 *  rather than the live measurement a test cannot take. */
const SCREEN_FRAME = { x: 0, y: 0, width: 390, height: 844 }
const INSETS = { top: 47, left: 0, right: 0, bottom: 34 }

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={{ frame: SCREEN_FRAME, insets: INSETS }}>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </SafeAreaProvider>
)

const renderScreen = () =>
  render(
    <Wrapper>
      <SendBitcoinDetailsScreen route={route} />
    </Wrapper>,
  )

describe("SendBitcoinDetailsScreen region gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreatePaymentDetail.mockReturnValue({
      canSetAmount: false,
      paymentType: "lightning",
      sendingWalletDescriptor: { id: BTC_WALLET.id, currency: "BTC" },
      convertMoneyAmount: jest.fn(),
      setConvertMoneyAmount: jest.fn(),
    })
    mockSendWallets.mockReturnValue(RESTRICTED_WALLETS)
  })

  /**
   * The screen chooses its sending wallet once and never revisits it, so choosing before the
   * region has answered is what left a restricted user sending from the dollar wallet the
   * verdict had just withdrawn.
   */
  it("does not choose a sending wallet while the region is still resolving", () => {
    mockSendWallets.mockReturnValue(PENDING_WALLETS)

    renderScreen()

    expect(mockCreatePaymentDetail).not.toHaveBeenCalled()
  })

  /** Holding is not blanking: the wait has to be visible, or the user stares at an empty
   *  screen for as long as the country takes. */
  it("shows a loader while the region is still resolving", () => {
    mockSendWallets.mockReturnValue(PENDING_WALLETS)

    const { getByTestId } = renderScreen()

    expect(getByTestId(PENDING_TEST_ID)).toBeTruthy()
  })

  it("chooses the sending wallet once the region resolves", () => {
    renderScreen()

    expect(mockCreatePaymentDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        sendingWalletDescriptor: { id: BTC_WALLET.id, currency: "BTC" },
      }),
    )
  })

  /** The whole point of the hold: the wallet the screen commits to is the one that survived
   *  the verdict, not the one that was on offer before it. */
  it("never seeds from the dollar wallet the restriction withdrew", () => {
    mockSendWallets.mockReturnValue(PENDING_WALLETS)
    const { rerender } = renderScreen()

    mockSendWallets.mockReturnValue(RESTRICTED_WALLETS)
    rerender(
      <Wrapper>
        <SendBitcoinDetailsScreen route={route} />
      </Wrapper>,
    )

    expect(mockCreatePaymentDetail).toHaveBeenCalledTimes(1)
    expect(mockCreatePaymentDetail).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sendingWalletDescriptor: { id: USD_WALLET.id, currency: "USD" },
      }),
    )
  })

  it("stops showing the loader once the region resolves", () => {
    const { queryByTestId } = renderScreen()

    expect(queryByTestId(PENDING_TEST_ID)).toBeNull()
  })
})
