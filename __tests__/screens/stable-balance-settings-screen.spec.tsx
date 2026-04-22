import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { WalletCurrency } from "@app/graphql/generated"

import { StableBalanceSettingsScreen } from "@app/screens/stable-balance-settings-screen"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
    View: RNView,
  }
})

const mockActivate = jest.fn()
const mockDeactivate = jest.fn()
const mockRefresh = jest.fn()
const mockRefreshStableBalanceActive = jest.fn()
const mockWallet = jest.fn()
const mockToggleQuote = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  activateStableBalance: (...args: unknown[]) => mockActivate(...args),
  deactivateStableBalance: (...args: unknown[]) => mockDeactivate(...args),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkToken: { Label: "USDB", Ticker: "USDB" },
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockWallet(),
}))

jest.mock(
  "@app/screens/stable-balance-settings-screen/hooks/use-stable-balance-toggle-quote",
  () => ({
    useStableBalanceToggleQuote: (...args: unknown[]) => mockToggleQuote(...args),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        settingsTitle: () => "Stable Balance",
        settingsDescription: () => "Stable Balance description.",
        activationLabel: () => "Active",
        activeHint: () => "Holding USD",
        inactiveHint: () => "Holding BTC only",
        deactivateWarningBody: ({ amount }: { amount: string }) =>
          `You still have ${amount} USD.`,
        toggleModal: {
          activateTitle: () => "Activate Stable Balance",
          activateBody: () => "Your BTC will be converted to USDB.",
          activateConfirm: () => "Activate",
          deactivateTitle: () => "Deactivate Stable Balance",
          deactivateBody: () => "Your USDB will be converted back to BTC.",
          deactivateConfirm: () => "Deactivate",
          cancel: () => "Cancel",
        },
      },
      ConversionConfirmationScreen: {
        feeLabel: () => "Conversion fee",
        feeError: () => "Couldn't fetch the conversion fee",
      },
      common: {
        cancel: () => "Cancel",
        switch: () => "Switch",
      },
    },
  }),
}))

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <StableBalanceSettingsScreen />
    </ThemeProvider>,
  )

const baseContext = {
  sdk: { updateUserSettings: jest.fn() },
  isStableBalanceActive: false,
  wallets: [
    {
      walletCurrency: WalletCurrency.Btc,
      balance: { amount: 0 },
    },
    {
      walletCurrency: WalletCurrency.Usd,
      balance: { amount: 0 },
    },
  ],
  refreshWallets: mockRefresh,
  refreshStableBalanceActive: mockRefreshStableBalanceActive,
}

const readyQuote = {
  isQuoting: false,
  hasQuoteError: false,
  feeText: "$0.05",
  adjustmentText: null,
}

describe("StableBalanceSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActivate.mockResolvedValue(undefined)
    mockDeactivate.mockResolvedValue(undefined)
    mockRefresh.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
    mockWallet.mockReturnValue(baseContext)
    mockToggleQuote.mockReturnValue(readyQuote)
  })

  it("renders the settings title and description", () => {
    const { getByText } = renderScreen()

    expect(getByText("Stable Balance")).toBeTruthy()
    expect(getByText("Stable Balance description.")).toBeTruthy()
  })

  it("shows inactive hint when Stable Balance is off", () => {
    const { getByText } = renderScreen()

    expect(getByText("Holding BTC only")).toBeTruthy()
  })

  it("shows active hint when Stable Balance is on", () => {
    mockWallet.mockReturnValue({ ...baseContext, isStableBalanceActive: true })
    const { getByText } = renderScreen()

    expect(getByText("Holding USD")).toBeTruthy()
  })

  it("activates directly when BTC balance is zero (no conversion needed)", async () => {
    const { getByTestId, queryByTestId } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith(baseContext.sdk, "USDB")
    })
    expect(queryByTestId("stable-balance-confirm-modal")).toBeNull()
  })

  it("deactivates directly when USD balance is zero (no conversion needed)", async () => {
    mockWallet.mockReturnValue({ ...baseContext, isStableBalanceActive: true })
    const { getByTestId, queryByTestId } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")

    await waitFor(() => {
      expect(mockDeactivate).toHaveBeenCalledWith(baseContext.sdk)
    })
    expect(queryByTestId("stable-balance-confirm-modal")).toBeNull()
  })

  it("shows confirm modal with fee on activate when BTC balance > 0", () => {
    mockWallet.mockReturnValue({
      ...baseContext,
      wallets: [
        { walletCurrency: WalletCurrency.Btc, balance: { amount: 5000 } },
        { walletCurrency: WalletCurrency.Usd, balance: { amount: 0 } },
      ],
    })
    const { getByTestId, getByText } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")

    expect(getByTestId("stable-balance-confirm-modal")).toBeTruthy()
    expect(getByText("Activate Stable Balance")).toBeTruthy()
    expect(getByText("$0.05")).toBeTruthy()
    expect(mockActivate).not.toHaveBeenCalled()
  })

  it("shows confirm modal with fee on deactivate when USD balance > 0", () => {
    mockWallet.mockReturnValue({
      ...baseContext,
      isStableBalanceActive: true,
      wallets: [
        { walletCurrency: WalletCurrency.Btc, balance: { amount: 1000 } },
        { walletCurrency: WalletCurrency.Usd, balance: { amount: 500 } },
      ],
    })
    const { getByTestId, getByText } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")

    expect(getByTestId("stable-balance-confirm-modal")).toBeTruthy()
    expect(getByText("Deactivate Stable Balance")).toBeTruthy()
    expect(getByText("You still have 5.00 USD.")).toBeTruthy()
    expect(getByText("$0.05")).toBeTruthy()
    expect(mockDeactivate).not.toHaveBeenCalled()
  })

  it("runs activation when the user confirms on the modal", async () => {
    mockWallet.mockReturnValue({
      ...baseContext,
      wallets: [
        { walletCurrency: WalletCurrency.Btc, balance: { amount: 5000 } },
        { walletCurrency: WalletCurrency.Usd, balance: { amount: 0 } },
      ],
    })
    const { getByTestId, getByText } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")
    fireEvent.press(getByText("Activate"))

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith(baseContext.sdk, "USDB")
    })
  })

  it("runs deactivation when the user confirms on the modal", async () => {
    mockWallet.mockReturnValue({
      ...baseContext,
      isStableBalanceActive: true,
      wallets: [
        { walletCurrency: WalletCurrency.Btc, balance: { amount: 1000 } },
        { walletCurrency: WalletCurrency.Usd, balance: { amount: 500 } },
      ],
    })
    const { getByTestId, getAllByText } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")
    // Two "Deactivate" strings: hint text and modal button — press the last (button)
    const deactivateButtons = getAllByText("Deactivate")
    fireEvent.press(deactivateButtons[deactivateButtons.length - 1])

    await waitFor(() => {
      expect(mockDeactivate).toHaveBeenCalledWith(baseContext.sdk)
    })
  })

  it("cancels the toggle without invoking the SDK when the user dismisses the modal", () => {
    mockWallet.mockReturnValue({
      ...baseContext,
      wallets: [
        { walletCurrency: WalletCurrency.Btc, balance: { amount: 5000 } },
        { walletCurrency: WalletCurrency.Usd, balance: { amount: 0 } },
      ],
    })
    const { getByTestId, getByText } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")
    fireEvent.press(getByText("Cancel"))

    expect(mockActivate).not.toHaveBeenCalled()
    expect(mockDeactivate).not.toHaveBeenCalled()
  })

  it("does not invoke the SDK when it is null (inactive wallet)", async () => {
    mockWallet.mockReturnValue({ ...baseContext, sdk: null })

    const { getByTestId } = renderScreen()

    fireEvent(getByTestId("stable-balance-switch"), "pressIn")

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(mockActivate).not.toHaveBeenCalled()
    expect(mockDeactivate).not.toHaveBeenCalled()
  })
})
