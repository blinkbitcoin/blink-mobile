import React from "react"
import { TouchableOpacity, View } from "react-native"
import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { SettingsScreenDocument } from "@app/graphql/generated"
import { NotificationHistoryScreen } from "@app/screens/notification-history-screen/notification-history-screen"
import { SettingsScreen } from "@app/screens/settings-screen/settings-screen"
import { LevelContextProvider, AccountLevel } from "@app/graphql/level-context"
import { LoggedInWithUsername } from "@app/screens/settings-screen/settings-screen.stories"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import mocks from "@app/graphql/mocks"
import { ContextForScreen } from "../helper"

const notificationTitle = "Test notification"
const notificationBody = "Test body"
const notificationCreatedAt = 1_720_000_000
const notificationNodes = [
  {
    id: "notif-1",
    title: notificationTitle,
    body: notificationBody,
    createdAt: notificationCreatedAt,
    acknowledgedAt: null,
    bulletinEnabled: false,
    icon: null,
    action: null,
    __typename: "StatefulNotification",
  },
  {
    id: "notif-2",
    title: notificationTitle,
    body: notificationBody,
    createdAt: notificationCreatedAt,
    acknowledgedAt: null,
    bulletinEnabled: false,
    icon: null,
    action: null,
    __typename: "StatefulNotification",
  },
  {
    id: "notif-3",
    title: notificationTitle,
    body: notificationBody,
    createdAt: notificationCreatedAt,
    acknowledgedAt: null,
    bulletinEnabled: false,
    icon: null,
    action: null,
    __typename: "StatefulNotification",
  },
]

let notificationCount = 3
let setActiveScreen: ((screen: string) => void) | null = null
let triggerRender: React.Dispatch<React.SetStateAction<number>> | null = null
let headerRight: (() => React.ReactNode) | null = null
let headerCount = -1

const updateNotificationCount = (next: number) => {
  notificationCount = next
  if (triggerRender) {
    triggerRender((value) => value + 1)
  }
}

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: (screen: string) => {
      mockNavigate(screen)
      if (setActiveScreen) {
        setActiveScreen(screen)
      }
    },
    setOptions: (options: { headerRight?: () => React.ReactNode }) => {
      if (options.headerRight && notificationCount !== headerCount) {
        headerCount = notificationCount
        headerRight = options.headerRight
        if (triggerRender) {
          triggerRender((value) => value + 1)
        }
      }
    },
  }),
  useIsFocused: () => true,
}))

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client")
  return {
    ...actual,
    useApolloClient: () => ({
      refetchQueries: jest.fn(() => {
        updateNotificationCount(notificationCount)
        return Promise.resolve()
      }),
    }),
  }
})

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useSettingsScreenQuery: jest.fn(() => ({
      data: {
        me: {
          id: "user-id",
          username: "test1",
          language: "en",
          totpEnabled: false,
          phone: "+50365055539",
          email: {
            address: "test@example.com",
            verified: true,
            __typename: "Email",
          },
          defaultAccount: {
            id: "account-id",
            defaultWalletId: "btc-wallet-id",
            wallets: [
              {
                id: "btc-wallet-id",
                balance: 0,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "usd-wallet-id",
                balance: 0,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
      loading: false,
    })),
    useUnacknowledgedNotificationCountQuery: jest.fn(() => ({
      data: {
        me: {
          id: "user-id",
          unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount:
            notificationCount,
        },
      },
    })),
    useStatefulNotificationsQuery: jest.fn(() => ({
      data: {
        me: {
          statefulNotificationsWithoutBulletinEnabled: {
            nodes: notificationNodes,
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
            },
          },
        },
      },
      loading: false,
      fetchMore: jest.fn(),
      refetch: jest.fn(),
    })),
    useStatefulNotificationAcknowledgeMutation: jest.fn((options) => {
      const ack = jest.fn(() => {
        updateNotificationCount(Math.max(notificationCount - 1, 0))
        return Promise.resolve()
      })
      return [ack, { loading: false }]
    }),
  }
})

const mocksWithUsername = [
  ...mocks,
  {
    request: {
      query: SettingsScreenDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          phone: "+50365055539",
          username: "test1",
          language: "en",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            displayCurrency: "EN",
            defaultWalletId: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

describe("Settings Screen", () => {
  beforeEach(() => {
    loadLocale("en")
    notificationCount = 3
    headerCount = -1
    setActiveScreen = null
    triggerRender = null
    headerRight = null
  })

  const TestNavigator = () => {
    const [screenName, setScreenName] = React.useState("settings")
    const [, setTick] = React.useState(0)

    setActiveScreen = setScreenName
    triggerRender = setTick

    return (
      <View>
        <View testID="notification-header">{headerRight ? headerRight() : null}</View>
        <SettingsScreen />
        {screenName === "notificationHistory" ? (
          <View>
            <TouchableOpacity
              testID="back-to-settings"
              onPress={() => setScreenName("settings")}
            />
            <NotificationHistoryScreen />
          </View>
        ) : null}
      </View>
    )
  }

  it("clears the badge after entering the notification history", async () => {
    render(
      <ContextForScreen>
        <LevelContextProvider
          value={{
            isAtLeastLevelZero: true,
            isAtLeastLevelOne: true,
            isAtLeastLevelTwo: false,
            isAtLeastLevelThree: false,
            currentLevel: AccountLevel.One,
          }}
        >
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const header = screen.getByTestId("notification-header")
    expect(within(header).getByTestId("notification-badge")).toBeTruthy()

    const headerButton = within(header).UNSAFE_getByType(TouchableOpacity)
    fireEvent.press(headerButton)
    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory")

    expect(screen.getByTestId("notification-screen")).toBeTruthy()
    expect(screen.getAllByText(notificationTitle)).toHaveLength(3)

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )
    fireEvent.press(screen.getByTestId("back-to-settings"))

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(within(header).queryByTestId("notification-badge")).toBeNull()
  })

  it("hides the badge when the last unread notification is acknowledged", async () => {
    notificationCount = 1
    headerCount = -1
    headerRight = null

    render(
      <ContextForScreen>
        <LevelContextProvider
          value={{
            isAtLeastLevelZero: true,
            isAtLeastLevelOne: true,
            isAtLeastLevelTwo: false,
            isAtLeastLevelThree: false,
            currentLevel: AccountLevel.One,
          }}
        >
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const header = screen.getByTestId("notification-header")
    expect(within(header).getByTestId("notification-badge")).toBeTruthy()

    const headerButton = within(header).UNSAFE_getByType(TouchableOpacity)
    fireEvent.press(headerButton)
    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory")

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )
    fireEvent.press(screen.getByTestId("back-to-settings"))

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(within(header).queryByTestId("notification-badge")).toBeNull()
  })

  it("does not render a badge when there are no unread notifications", async () => {
    notificationCount = 0
    headerCount = -1
    headerRight = null

    render(
      <ContextForScreen>
        <LevelContextProvider
          value={{
            isAtLeastLevelZero: true,
            isAtLeastLevelOne: true,
            isAtLeastLevelTwo: false,
            isAtLeastLevelThree: false,
            currentLevel: AccountLevel.One,
          }}
        >
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const header = screen.getByTestId("notification-header")
    expect(within(header).queryByTestId("notification-badge")).toBeNull()
  })

  it("Renders user info", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const elements = screen.getAllByText("test1@blink.sv")
    expect(elements.length).toBeGreaterThan(0)
  })
})
