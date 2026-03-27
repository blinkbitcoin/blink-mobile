import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcNewConnectionFormScreen } from "@app/screens/nostr-wallet-connect/new-connection-form-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

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

const mockAddConnection = jest.fn()
const mockSetAppName = jest.fn()
const mockSelectBudget = jest.fn()

let mockIsValid = false
let mockAppName = ""

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useNwcConnections: () => ({
    addConnection: mockAddConnection,
  }),
  useNewConnection: () => ({
    appName: mockAppName,
    setAppName: mockSetAppName,
    dailyBudgetSats: 10_000,
    isValid: mockIsValid,
    selectBudget: mockSelectBudget,
  }),
}))

describe("NwcNewConnectionFormScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsValid = false
    mockAppName = ""
  })

  it("renders form fields", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcNewConnectionFormScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.appNameLabel())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.dailyBudget())).toBeTruthy()
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

    mockAddConnection.mockReturnValue({
      id: "1",
      appName: "Amethyst",
      dailyBudgetSats: 10_000,
      connectionString: "nostr+walletconnect://abc123",
      createdAt: Date.now(),
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

    expect(mockAddConnection).toHaveBeenCalledWith("Amethyst", 10_000)
  })

  it("navigates to nwcConnectionCreated on connect", async () => {
    mockIsValid = true
    mockAppName = "Damus"

    mockAddConnection.mockReturnValue({
      id: "2",
      appName: "Damus",
      dailyBudgetSats: 10_000,
      connectionString: "nostr+walletconnect://xyz789",
      createdAt: Date.now(),
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
})
