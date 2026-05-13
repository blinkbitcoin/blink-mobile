import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcNewConnectionFormScreen } from "@app/screens/nostr-wallet-connect/new-connection-form-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockCreateManualNwcConnection = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

jest.mock("@app/components/animations", () => ({
  useDashedLineFlow: () => ({
    animatedProps: {},
    dashArray: "5 5",
  }),
}))

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (Component: React.ComponentType) => Component,
  },
}))

jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native")
  const actual = jest.requireActual("react-native-svg")
  return {
    ...actual,
    __esModule: true,
    default: View,
    Line: View,
  }
})

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} SAT`,
  }),
}))

const mockSetAppName = jest.fn()
const mockSetBudgetEnabled = jest.fn()
const mockSetBudgetAmount = jest.fn()
const mockSetPermissionEnabled = jest.fn()

let mockIsValid = false
let mockAppName = ""
let mockEnabledBudgetCount = 0
let mockBudgetsForCreate: ReadonlyArray<{ amountSats: number; period: "DAILY" }> = []
let mockPermissions: ReadonlyArray<string> = ["GET_INFO", "MAKE_INVOICE"]
type MockBudgetConfig = {
  period: "DAILY" | "WEEKLY" | "MONTHLY" | "NEVER"
  amountSatsText: string
  enabled: boolean
}
let mockBudgetConfigs: ReadonlyArray<MockBudgetConfig> = [
  { period: "DAILY", amountSatsText: "", enabled: false },
  { period: "WEEKLY", amountSatsText: "", enabled: false },
  { period: "MONTHLY", amountSatsText: "", enabled: false },
  { period: "NEVER", amountSatsText: "", enabled: false },
]

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useCreateNwcConnection: () => ({
    createManualNwcConnection: mockCreateManualNwcConnection,
    loading: false,
  }),
  useNewConnection: () => ({
    appName: mockAppName,
    setAppName: mockSetAppName,
    budgetConfigs: mockBudgetConfigs,
    budgetsForCreate: mockBudgetsForCreate,
    enabledBudgetCount: mockEnabledBudgetCount,
    permissions: mockPermissions,
    permissionToggles: {
      receiveOnly: true,
      readHistory: false,
      makePayments: false,
    },
    isValid: mockIsValid,
    setBudgetEnabled: mockSetBudgetEnabled,
    setBudgetAmount: mockSetBudgetAmount,
    setPermissionEnabled: mockSetPermissionEnabled,
  }),
}))

describe("NwcNewConnectionFormScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsValid = false
    mockAppName = ""
    mockEnabledBudgetCount = 0
    mockBudgetsForCreate = []
    mockPermissions = ["GET_INFO", "MAKE_INVOICE"]
    mockBudgetConfigs = [
      { period: "DAILY", amountSatsText: "", enabled: false },
      { period: "WEEKLY", amountSatsText: "", enabled: false },
      { period: "MONTHLY", amountSatsText: "", enabled: false },
      { period: "NEVER", amountSatsText: "", enabled: false },
    ]
    mockCreateManualNwcConnection.mockResolvedValue({
      errors: [],
      connectionUri: "nostr+walletconnect://created",
      connection: {
        id: "1",
        appName: "Created app",
        dailyBudgetSats: 10_000,
        connectionString: "nostr+walletconnect://created",
        createdAt: Date.now(),
      },
    })
  })

  it("renders form fields", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.appNameLabel())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.setBudget())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissions())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionReceiveOnly())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionReadHistory())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionMakePayments())).toBeTruthy()
  })

  it("expands budget rows from the set budget control", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.setBudget()))
    })

    expect(getByText(LL.NostrWalletConnect.periodDaily())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.periodWeekly())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.periodMonthly())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.periodAnnually())).toBeTruthy()
  })

  it("renders connect button disabled initially", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.connectWallet())
    expect(button).toBeTruthy()
  })

  it("enables connect button when isValid is true", async () => {
    mockIsValid = true
    mockAppName = "Amethyst"

    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.connectWallet())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockCreateManualNwcConnection).toHaveBeenCalledWith({
      appName: "Amethyst",
      budgets: [],
      permissions: ["GET_INFO", "MAKE_INVOICE"],
    })
  })

  it("passes selected budgets and permissions to create", async () => {
    mockIsValid = true
    mockAppName = "Amethyst"
    mockEnabledBudgetCount = 1
    mockBudgetsForCreate = [{ amountSats: 10_000, period: "DAILY" }]
    mockPermissions = ["GET_INFO", "MAKE_INVOICE", "PAY_INVOICE"]

    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.connectWallet())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockCreateManualNwcConnection).toHaveBeenCalledWith({
      appName: "Amethyst",
      budgets: [{ amountSats: 10_000, period: "DAILY" }],
      permissions: ["GET_INFO", "MAKE_INVOICE", "PAY_INVOICE"],
    })
  })

  it("navigates to nwcConnectionCreated on connect", async () => {
    mockIsValid = true
    mockAppName = "Damus"

    mockCreateManualNwcConnection.mockResolvedValue({
      errors: [],
      connectionUri: "nostr+walletconnect://xyz789",
      connection: {
        id: "2",
        appName: "Damus",
        dailyBudgetSats: 10_000,
        connectionString: "nostr+walletconnect://xyz789",
        createdAt: Date.now(),
      },
    })

    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.connectWallet())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("nwcConnectionCreated", {
      connectionString: "nostr+walletconnect://xyz789",
      appName: "Damus",
    })
  })

  it("shows create errors without navigating", async () => {
    mockIsValid = true
    mockAppName = "Damus"
    mockCreateManualNwcConnection.mockResolvedValue({
      errors: [{ code: "NETWORK_ERROR", message: "network" }],
      connectionUri: undefined,
      connection: undefined,
    })

    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.connectWallet())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(getByText("network")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "nwcConnectionCreated",
      expect.anything(),
    )
  })
})
