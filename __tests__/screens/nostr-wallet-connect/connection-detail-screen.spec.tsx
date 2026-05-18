import React from "react"
import { render, fireEvent, act, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcConnectionDetailScreen } from "@app/screens/nostr-wallet-connect/connection-detail-screen"
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
    useRoute: () => ({
      params: { connectionId: "conn-1" },
    }),
  }
})

const mockRefresh = jest.fn()
const mockRevokeConnection = jest.fn()
const mockConnection = {
  id: "conn-1",
  appName: "Amethyst",
  alias: "Amethyst",
  appPubkey: "a".repeat(64),
  permissions: ["GET_INFO", "PAY_INVOICE"] as const,
  budgets: [
    {
      amountSats: 10_000,
      usedSats: 2_500,
      remainingSats: 7_500,
      period: "DAILY" as const,
      resetsAt: null,
    },
  ],
  revoked: false,
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: 1_700_000_000,
  createdAt: 1_690_000_000,
  updatedAt: 1_700_000_000,
}
let currentConnection: typeof mockConnection | undefined = mockConnection
let mockLoading = false
let mockError: Error | undefined

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useNwcConnectionQuery: () => ({
    connection: currentConnection,
    error: mockError,
    loading: mockLoading,
    refreshing: false,
    refresh: mockRefresh,
  }),
  useNwcConnectionRevoke: () => ({
    revokeConnection: mockRevokeConnection,
    loading: false,
  }),
  getNwcConnectionStatus: (connection: {
    revoked: boolean
    expiresAt?: number | null
  }) => {
    if (connection.revoked) return "revoked"
    if (connection.expiresAt && connection.expiresAt <= Math.floor(Date.now() / 1000)) {
      return "expired"
    }
    return "active"
  },
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} SAT`,
  }),
}))

jest.mock("@app/components/custom-modal/custom-modal", () => ({
  __esModule: true,
  default: ({
    isVisible,
    title,
    body,
    primaryButtonTitle,
    primaryButtonOnPress,
    secondaryButtonTitle,
    secondaryButtonOnPress,
  }: {
    isVisible: boolean
    title: string
    body: React.ReactNode
    primaryButtonTitle: string
    primaryButtonOnPress: () => void
    secondaryButtonTitle?: string
    secondaryButtonOnPress?: () => void
  }) => {
    const { Text, View, Pressable } = jest.requireActual("react-native")
    if (!isVisible) return null
    return (
      <View testID="revoke-modal">
        <Text>{title}</Text>
        {body}
        <Pressable onPress={primaryButtonOnPress}>
          <Text>{primaryButtonTitle}</Text>
        </Pressable>
        {secondaryButtonTitle && secondaryButtonOnPress && (
          <Pressable onPress={secondaryButtonOnPress} testID="confirm-revoke">
            <Text>{secondaryButtonTitle}</Text>
          </Pressable>
        )}
      </View>
    )
  },
}))

describe("NwcConnectionDetailScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    currentConnection = mockConnection
    mockLoading = false
    mockError = undefined
    mockRefresh.mockResolvedValue(undefined)
    mockRevokeConnection.mockResolvedValue({
      success: true,
      errors: [],
      connection: { ...mockConnection, revoked: true },
    })
  })

  it("renders connection details, permissions, and budget usage", async () => {
    const { getByText, getAllByText } = render(
      <ContextForScreen>
        <NwcConnectionDetailScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Amethyst")).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.statusActive())).toBeTruthy()
    expect(getByText("2023-07-22 04:26")).toBeTruthy()
    expect(getByText("2023-11-14 22:13")).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionGetInfo())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionPayInvoice())).toBeTruthy()
    expect(getAllByText(LL.NostrWalletConnect.periodDaily()).length).toBeGreaterThan(0)
    expect(
      getByText(
        LL.NostrWalletConnect.budgetUsage({
          used: "2500 SAT",
          amount: "10000 SAT",
        }),
      ),
    ).toBeTruthy()
  })

  it("revokes the connection and returns to connected apps", async () => {
    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <NwcConnectionDetailScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.revokeConnection()))
    })

    expect(getByText(LL.NostrWalletConnect.revokeConfirmTitle())).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByTestId("confirm-revoke"))
    })

    await waitFor(() => {
      expect(mockRevokeConnection).toHaveBeenCalledWith("conn-1")
      expect(mockNavigate).toHaveBeenCalledWith("nwcConnectedApps")
    })
  })

  it("shows an error and stays on screen when revocation fails", async () => {
    mockRevokeConnection.mockResolvedValueOnce({
      success: false,
      errors: [{ message: "Backend refused revoke" }],
    })

    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <NwcConnectionDetailScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.revokeConnection()))
    })

    await act(async () => {
      fireEvent.press(getByTestId("confirm-revoke"))
    })

    await waitFor(() => {
      expect(getByText("Backend refused revoke")).toBeTruthy()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
