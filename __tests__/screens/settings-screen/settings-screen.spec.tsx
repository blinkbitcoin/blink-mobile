import React from "react"
import { TouchableOpacity, View } from "react-native"
import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { SettingsScreenDocument } from "@app/graphql/generated"
import { NotificationHistoryScreen } from "@app/screens/notification-history-screen/notification-history-screen"
import { SettingsScreen } from "@app/screens/settings-screen/settings-screen"
import { SettingsRow } from "@app/screens/settings-screen/row"
import { LevelContextProvider, AccountLevel } from "@app/graphql/level-context"
import { LoggedInWithUsername } from "@app/screens/settings-screen/settings-screen.stories"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import mocks from "@app/graphql/mocks"
import { ContextForScreen } from "../helper"

const notificationTitle = "Test notification"
const notificationBody = "Test body"
const notificationCreatedAt = 1_720_000_000
const baseNotificationNodes: Array<{
  id: string
  title: string
  body: string
  createdAt: number
  acknowledgedAt: number | null
  bulletinEnabled: boolean
  icon: null
  action: null
  __typename: "StatefulNotification"
}> = [
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

type TestState = {
  notificationCount: number
  notificationNodes: typeof baseNotificationNodes
  phone: string | null
  setActiveScreen: ((screen: string) => void) | null
  triggerRender: React.Dispatch<React.SetStateAction<number>> | null
  headerRight: (() => React.ReactNode) | null
  headerCount: number
}

const buildNotificationNodes = (unreadCount: number) =>
  baseNotificationNodes.map((notification, index) => ({
    ...notification,
    acknowledgedAt: index < unreadCount ? null : 1,
  }))

const createTestState = (): TestState => ({
  notificationCount: 3,
  notificationNodes: buildNotificationNodes(3),
  phone: "+50365055539",
  setActiveScreen: null,
  triggerRender: null,
  headerRight: null,
  headerCount: -1,
})

let testState = createTestState()

const updateNotificationCount = (next: number) => {
  testState.notificationCount = next
  testState.notificationNodes = buildNotificationNodes(next)
  if (testState.triggerRender) {
    testState.triggerRender((value) => value + 1)
  }
}

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: (screen: string) => {
      mockNavigate(screen)
      if (testState.setActiveScreen) {
        testState.setActiveScreen(screen)
      }
    },
    setOptions: (options: { headerRight?: () => React.ReactNode }) => {
      if (options.headerRight && testState.notificationCount !== testState.headerCount) {
        testState.headerCount = testState.notificationCount
        testState.headerRight = options.headerRight
        if (testState.triggerRender) {
          testState.triggerRender((value) => value + 1)
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
        updateNotificationCount(testState.notificationCount)
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
          phone: testState.phone,
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
            testState.notificationCount,
        },
      },
    })),
    useStatefulNotificationsQuery: jest.fn(() => ({
      data: {
        me: {
          statefulNotificationsWithoutBulletinEnabled: {
            nodes: testState.notificationNodes,
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
    useStatefulNotificationAcknowledgeMutation: jest.fn((_options) => {
      const ack = jest.fn(() => {
        updateNotificationCount(Math.max(testState.notificationCount - 1, 0))
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
    testState = createTestState()
  })

  const TestNavigator = () => {
    const [screenName, setScreenName] = React.useState("settings")
    const [, setTick] = React.useState(0)

    testState.setActiveScreen = setScreenName
    testState.triggerRender = setTick

    return (
      <View>
        <View testID="notification-header">
          {testState.headerRight ? testState.headerRight() : null}
        </View>
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
    updateNotificationCount(1)
    testState.headerCount = -1
    testState.headerRight = null

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
    updateNotificationCount(0)
    testState.headerCount = -1
    testState.headerRight = null

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

  it("shows phone ln address when phone is verified", async () => {
    const phone = "+50365055539"
    const lnAddress = `${phone}@blink.sv`
    testState.phone = phone

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

    expect(screen.getByText(lnAddress)).toBeTruthy()
  })

  it("hides phone ln address when phone is missing", async () => {
    testState.phone = null

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

    expect(screen.queryByText("Set your lightning address")).toBeNull()
    expect(screen.queryByText("+50365055539@blink.sv")).toBeNull()
  })

  it("truncates long settings row titles", () => {
    const longTitle = "This is a very long settings row title that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} />
      </ContextForScreen>,
    )

    const titleNode = screen.getByText(longTitle)
    expect(titleNode.props.numberOfLines).toBe(1)
    expect(titleNode.props.ellipsizeMode).toBe("tail")
  })

  it("truncates long settings row subtitles", () => {
    const longTitle = "Short title"
    const longSubtitle = "This is a very long subtitle that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle} />
      </ContextForScreen>,
    )

    const subtitleNode = screen.getByText(longSubtitle)
    expect(subtitleNode.props.numberOfLines).toBe(1)
    expect(subtitleNode.props.ellipsizeMode).toBe("tail")
  })

  it("truncates long title and subtitle together", () => {
    const longTitle = "Another very long settings row title that should truncate"
    const longSubtitle = "Another very long subtitle that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle} />
      </ContextForScreen>,
    )

    const titleNode = screen.getByText(longTitle)
    const subtitleNode = screen.getByText(longSubtitle)
    expect(titleNode.props.numberOfLines).toBe(1)
    expect(titleNode.props.ellipsizeMode).toBe("tail")
    expect(subtitleNode.props.numberOfLines).toBe(1)
    expect(subtitleNode.props.ellipsizeMode).toBe("tail")
  })
})
