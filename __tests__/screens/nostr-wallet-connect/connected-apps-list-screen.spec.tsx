import React from "react"
import { render, fireEvent, act, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcConnectedAppsListScreen } from "@app/screens/nostr-wallet-connect/connected-apps-list-screen"
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

const mockRefresh = jest.fn()
const mockRevokeAllConnections = jest.fn()
const defaultMockConnections = [
  {
    id: "conn-1",
    appName: "Amethyst",
    alias: "Amethyst",
    appPubkey: "a".repeat(64),
    permissions: ["GET_INFO", "PAY_INVOICE"] as const,
    budgets: [
      {
        amountSats: 10_000,
        usedSats: 1_000,
        remainingSats: 9_000,
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
  },
  {
    id: "conn-2",
    appName: "Damus",
    alias: "Damus",
    appPubkey: "b".repeat(64),
    permissions: ["GET_INFO"] as const,
    budgets: [],
    revoked: false,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: 1_690_000_100,
    updatedAt: 1_690_000_100,
  },
]
let mockConnections = defaultMockConnections
let mockLoading = false
let mockError: Error | undefined

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useNwcConnectionsQuery: () => ({
    connections: mockConnections,
    connectionCount: mockConnections.length,
    error: mockError,
    loading: mockLoading,
    refreshing: false,
    refresh: mockRefresh,
  }),
  useNwcConnectionsRevokeAll: () => ({
    revokeAllConnections: mockRevokeAllConnections,
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
    primaryButtonDisabled,
    secondaryButtonTitle,
    secondaryButtonOnPress,
  }: {
    isVisible: boolean
    title: string
    body: React.ReactNode
    primaryButtonTitle: string
    primaryButtonOnPress: () => void
    primaryButtonDisabled?: boolean
    secondaryButtonTitle?: string
    secondaryButtonOnPress?: () => void
  }) => {
    const { Text, View, Pressable } = jest.requireActual("react-native")
    if (!isVisible) return null
    return (
      <View testID="revoke-all-modal">
        <Text>{title}</Text>
        {body}
        <Pressable
          onPress={primaryButtonDisabled ? undefined : primaryButtonOnPress}
          testID="modal-primary"
          accessibilityState={{ disabled: Boolean(primaryButtonDisabled) }}
        >
          <Text>{primaryButtonTitle}</Text>
        </Pressable>
        {secondaryButtonTitle && secondaryButtonOnPress && (
          <Pressable onPress={secondaryButtonOnPress} testID="modal-secondary">
            <Text>{secondaryButtonTitle}</Text>
          </Pressable>
        )}
      </View>
    )
  },
}))

describe("NwcConnectedAppsListScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockConnections = defaultMockConnections
    mockLoading = false
    mockError = undefined
    mockRefresh.mockResolvedValue(undefined)
    mockRevokeAllConnections.mockResolvedValue({
      success: true,
      revokedCount: 2,
      errors: [],
    })
  })

  it("renders backend connections with last-used and status", async () => {
    const { getByText, getAllByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Amethyst")).toBeTruthy()
    expect(getByText("Damus")).toBeTruthy()
    expect(getAllByText(LL.NostrWalletConnect.statusActive())).toHaveLength(2)
    expect(
      getByText(LL.NostrWalletConnect.lastUsed({ date: "2023-11-14 22:13" })),
    ).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.neverUsed())).toBeTruthy()
  })

  it("navigates to connection detail on connection press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Amethyst"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("nwcConnectionDetail", {
      connectionId: "conn-1",
    })
  })

  it("renders an empty state when there are no connections", async () => {
    mockConnections = []

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.connectedAppsEmptyTitle())).toBeTruthy()
    expect(queryByText("BTCpayserver")).toBeNull()
  })

  it("navigates to nwcNewConnection on new connection press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.newConnection()))
    })

    expect(mockNavigate).toHaveBeenCalledWith("nwcNewConnection")
  })

  it("requires typed confirmation before revoking all connections", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.revokeAllConnections()))
    })

    expect(getByTestId("modal-primary").props.accessibilityState.disabled).toBe(true)

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("REVOKE"), "REVOKE")
    })

    expect(getByTestId("modal-primary").props.accessibilityState.disabled).toBe(false)

    await act(async () => {
      fireEvent.press(getByTestId("modal-primary"))
    })

    await waitFor(() => {
      expect(mockRevokeAllConnections).toHaveBeenCalledTimes(1)
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
