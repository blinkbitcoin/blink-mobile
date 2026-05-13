import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcAuthorizationScreen } from "@app/screens/nostr-wallet-connect/authorization-screen"
import { ContextForScreen } from "../helper"

const PUBKEY = "a".repeat(64)
const SECRET = "b".repeat(64)
const VALID_URI = `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&lud16=Amethyst`

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockCreateNwcConnection = jest.fn()
let mockUri = VALID_URI
let mockCanGoBack = true
let mockIsCreating = false
let mockBtcBalance = 20_000

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      canGoBack: () => mockCanGoBack,
    }),
    useRoute: () => ({
      params: {
        uri: mockUri,
      },
    }),
  }
})

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useCreateNwcConnection: () => ({
    createNwcConnection: mockCreateNwcConnection,
    loading: mockIsCreating,
  }),
  useNwcBtcBalance: () => mockBtcBalance,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} SAT`,
  }),
}))

describe("NwcAuthorizationScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUri = VALID_URI
    mockCanGoBack = true
    mockIsCreating = false
    mockBtcBalance = 20_000
    mockCreateNwcConnection.mockResolvedValue({
      errors: [],
      connectionUri: "nostr+walletconnect://created",
      connection: {
        id: "conn-1",
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
        createdAt: 1700000000000,
      },
    })
  })

  it("renders the authorization details for a valid NWC URI", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(LL.NostrWalletConnect.authorizationAppTitle({ appName: "Amethyst" })),
    ).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.willBeAbleTo())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionPayInvoice())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.budgetAmount())).toBeTruthy()
  })

  it("creates a local connection and navigates to success on authorize", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.authorize()))
    })

    expect(mockCreateNwcConnection).toHaveBeenCalledWith({
      nwcUri: VALID_URI,
      alias: "Amethyst",
      permissions: ["GET_INFO", "GET_BALANCE", "PAY_INVOICE"],
      budgets: [
        {
          amountSats: 10_000,
          period: "WEEKLY",
        },
      ],
      appName: "Amethyst",
      appPubkey: PUBKEY,
      replaceExisting: false,
    })
    expect(mockNavigate).toHaveBeenCalledWith("nwcConnectionCreated", {
      appName: "Amethyst",
      successMode: "authorization",
      permissions: ["GET_INFO", "GET_BALANCE", "PAY_INVOICE"],
      budgets: [
        {
          amountSats: 10_000,
          period: "WEEKLY",
        },
      ],
      returnUrl: undefined,
    })
  })

  it("warns when requested budget is higher than the BTC balance", async () => {
    mockBtcBalance = 100

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.budgetExceedsBalanceWarning())).toBeTruthy()
  })

  it("shows create errors without navigating", async () => {
    mockCreateNwcConnection.mockResolvedValue({
      errors: [{ code: "DUPLICATE_CONNECTION", message: "duplicate" }],
      connectionUri: undefined,
      connection: undefined,
    })

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.authorize()))
    })

    expect(getByText(LL.NostrWalletConnect.connectionAlreadyExists())).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "nwcConnectionCreated",
      expect.anything(),
    )
  })

  it("shows retry for transient create errors", async () => {
    mockCreateNwcConnection.mockResolvedValue({
      errors: [{ code: "NETWORK_ERROR", message: "network", retryable: true }],
      connectionUri: undefined,
      connection: undefined,
    })

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.authorize()))
    })

    expect(getByText("network")).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.retry())).toBeTruthy()
  })

  it("offers replace for duplicate create errors", async () => {
    mockCreateNwcConnection.mockResolvedValue({
      errors: [{ code: "DUPLICATE_CONNECTION", message: "duplicate", replaceable: true }],
      connectionUri: undefined,
      connection: undefined,
    })

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.authorize()))
    })

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.replaceConnection()))
    })

    expect(mockCreateNwcConnection).toHaveBeenLastCalledWith(
      expect.objectContaining({ replaceExisting: true }),
    )
  })

  it("shows a validation error for malformed NWC URIs", async () => {
    mockUri = "nostr+walletconnect://bad"

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.invalidConnectionRequest())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.invalidNwcPubkey())).toBeTruthy()
  })

  it("returns to Primary when canceling without a previous screen", async () => {
    mockUri = "nostr+walletconnect://bad"
    mockCanGoBack = false

    const { getByText } = render(
      <ContextForScreen>
        <NwcAuthorizationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.common.cancel()))
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })
})
