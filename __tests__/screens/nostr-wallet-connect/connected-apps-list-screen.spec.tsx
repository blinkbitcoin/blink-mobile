import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcConnectedAppsListScreen } from "@app/screens/nostr-wallet-connect/connected-apps-list-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockReplace = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
    }),
  }
})

const mockRemoveConnection = jest.fn()
const defaultMockConnections = [
  {
    id: "conn-1",
    appName: "Amethyst",
    dailyBudgetSats: 10_000,
    connectionString: "nostr+walletconnect://abc",
    createdAt: 1700000000000,
  },
  {
    id: "conn-2",
    appName: "Damus",
    dailyBudgetSats: 1_000,
    connectionString: "nostr+walletconnect://xyz",
    createdAt: 1700000001000,
  },
]
let mockConnections = defaultMockConnections

jest.mock("@app/screens/nostr-wallet-connect/hooks", () => ({
  useNwcConnections: () => ({
    connections: mockConnections,
    removeConnection: mockRemoveConnection,
    hasConnections: mockConnections.length > 0,
  }),
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
    secondaryButtonTitle: string
    secondaryButtonOnPress: () => void
  }) => {
    const { Text, View, Pressable } = jest.requireActual("react-native")
    if (!isVisible) return null
    return (
      <View testID="delete-modal">
        <Text>{title}</Text>
        {body}
        <Pressable onPress={primaryButtonOnPress}>
          <Text>{primaryButtonTitle}</Text>
        </Pressable>
        <Pressable onPress={secondaryButtonOnPress} testID="confirm-delete">
          <Text>{secondaryButtonTitle}</Text>
        </Pressable>
      </View>
    )
  },
}))

describe("NwcConnectedAppsListScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockConnections = defaultMockConnections
  })

  it("renders connection cards", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Amethyst")).toBeTruthy()
    expect(getByText("Damus")).toBeTruthy()
  })

  it("does not render a mock fallback when there are no connections", async () => {
    mockConnections = []

    const { queryByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(queryByText("BTCpayserver")).toBeNull()
  })

  it("renders budget for each connection", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.budget({ amount: "10000 SAT" }))).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.budget({ amount: "1000 SAT" }))).toBeTruthy()
  })

  it("shows delete modal on close icon press", async () => {
    const { getByText, queryByTestId, getAllByTestId } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(queryByTestId("delete-modal")).toBeNull()

    const closeIcons = getAllByTestId("icon-close")
    await act(async () => {
      fireEvent.press(closeIcons[0])
    })

    expect(getByText(LL.NostrWalletConnect.deleteConfirmTitle())).toBeTruthy()
  })

  it("removes connection on confirm delete", async () => {
    const { getByTestId, getAllByTestId } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const closeIcons = getAllByTestId("icon-close")
    await act(async () => {
      fireEvent.press(closeIcons[0])
    })

    const confirmButton = getByTestId("confirm-delete")
    await act(async () => {
      fireEvent.press(confirmButton)
    })

    expect(mockRemoveConnection).toHaveBeenCalledWith("conn-1")
  })

  it("returns to the empty state after deleting the last connection", async () => {
    mockConnections = [defaultMockConnections[0]]

    const { getByTestId, getAllByTestId } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const closeIcons = getAllByTestId("icon-close")
    await act(async () => {
      fireEvent.press(closeIcons[0])
    })

    const confirmButton = getByTestId("confirm-delete")
    await act(async () => {
      fireEvent.press(confirmButton)
    })

    expect(mockRemoveConnection).toHaveBeenCalledWith("conn-1")
    expect(mockReplace).toHaveBeenCalledWith("nwcEmptyState")
  })

  it("renders threshold field", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.doNotNotifyBelow())).toBeTruthy()
  })

  it("renders the new connection button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.newConnection())).toBeTruthy()
  })

  it("navigates to nwcNewConnection on new connection press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectedAppsListScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.newConnection())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("nwcNewConnection")
  })
})
