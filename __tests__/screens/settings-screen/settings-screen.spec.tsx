jest.mock("@app/self-custodial/hooks/use-backup-nudge-state", () => ({
  useBackupNudgeState: () => ({
    shouldShowBanner: false,
    shouldShowModal: false,
    shouldShowSettingsBanner: false,
    dismissBanner: jest.fn(),
    dismissModal: jest.fn(),
  }),
}))

const mockUseIsAuthed = jest.fn(() => true)
jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockUseIsAuthed(),
}))

/** Overrides only activeAccount so the self-custodial gating cases can flip the mode
 *  while every other registry consumer keeps the real provider behavior. */
const mockAccountRegistryOverride: { activeAccount: unknown } = {
  activeAccount: undefined,
}
jest.mock("@app/hooks/use-account-registry", () => {
  const actual = jest.requireActual("@app/hooks/use-account-registry")
  return {
    ...actual,
    useAccountRegistry: () => ({
      ...actual.useAccountRegistry(),
      ...(mockAccountRegistryOverride.activeAccount
        ? { activeAccount: mockAccountRegistryOverride.activeAccount }
        : {}),
    }),
  }
})

/** The self-custodial rows read the wallet context; a connected stub keeps them out of
 *  their loading-skeleton states so the gating assertions can find row titles. */
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    sdk: {},
    lightningAddress: null,
    wallets: [],
    allTransactions: [],
  }),
}))

import React from "react"
import { TouchableOpacity, View } from "react-native"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { createCache } from "@app/graphql/cache"
import { SettingsScreenDocument } from "@app/graphql/generated"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { NotificationHistoryScreen } from "@app/screens/notification-history-screen/notification-history-screen"
import { SettingsScreen } from "@app/screens/settings-screen/settings-screen"
import { SettingsRow } from "@app/screens/settings-screen/row"
import { LevelContextProvider, AccountLevel } from "@app/graphql/level-context"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import mocks from "@app/graphql/mocks"
import { AccountType } from "@app/types/wallet"
import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const LoggedInWithUsername = ({ mock }: { mock: MockedResponse[] }) => (
  <MockedProvider mocks={mock} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SettingsScreen />
    </IsAuthedContextProvider>
  </MockedProvider>
)

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

jest.mock("@app/utils/ip-country-lookup")

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockPromptEnhancedMode = jest.fn()
jest.mock("@app/components/enhanced-mode-prompt", () => ({
  ...jest.requireActual("@app/components/enhanced-mode-prompt"),
  useEnhancedModePrompt: () => ({
    promptEnhancedMode: mockPromptEnhancedMode,
    isEnhancedModePromptVisible: false,
  }),
}))

let mockIsRestrictedRegion = false
const mockPresentRestrictedRegionModal = jest.fn()
jest.mock("@app/components/restricted-region", () => ({
  ...jest.requireActual("@app/components/restricted-region"),
  useRestrictedRegion: () => ({
    isRestrictedRegion: mockIsRestrictedRegion,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: mockPresentRestrictedRegionModal,
  }),
}))

/** The fake Apollo client above has no writeQuery, so the real updateCountryCode would throw and warn on every device-location render. */
jest.mock("@app/graphql/client-only-query", () => ({
  ...jest.requireActual("@app/graphql/client-only-query"),
  updateCountryCode: jest.fn(),
}))

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
    jest.clearAllMocks()
    // clearAllMocks does not reset return values, so re-arm the default explicitly
    mockUseIsAuthed.mockReturnValue(true)
    mockAccountRegistryOverride.activeAccount = undefined
    mockIsRestrictedRegion = false
    mockIsAnonMode = false
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

    const header = screen.getByTestId("notification-header")
    await waitFor(() => {
      expect(within(header).getByTestId("notification-badge")).toBeTruthy()
    })

    const headerButton = within(header).UNSAFE_getByType(TouchableOpacity)
    fireEvent.press(headerButton)
    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory")

    expect(screen.getByTestId("notification-screen")).toBeTruthy()
    expect(screen.getAllByText(notificationTitle)).toHaveLength(3)

    // acknowledgements drain while the history screen is open; wait for the
    // badge to clear instead of sleeping a fixed amount
    await waitFor(() => {
      expect(within(header).queryByTestId("notification-badge")).toBeNull()
    })

    fireEvent.press(screen.getByTestId("back-to-settings"))
    await waitFor(() => {
      expect(screen.queryByTestId("notification-screen")).toBeNull()
    })

    expect(within(header).queryByTestId("notification-badge")).toBeNull()

    await flushEffects()
  })

  it("hides the badge when the last unread notification is acknowledged", async () => {
    updateNotificationCount(1)

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

    const header = screen.getByTestId("notification-header")
    await waitFor(() => {
      expect(within(header).getByTestId("notification-badge")).toBeTruthy()
    })

    const headerButton = within(header).UNSAFE_getByType(TouchableOpacity)
    fireEvent.press(headerButton)
    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory")

    // the last unread notification is acknowledged on entry; wait for the
    // badge to clear instead of sleeping a fixed amount
    await waitFor(() => {
      expect(within(header).queryByTestId("notification-badge")).toBeNull()
    })

    fireEvent.press(screen.getByTestId("back-to-settings"))
    await waitFor(() => {
      expect(screen.queryByTestId("notification-screen")).toBeNull()
    })

    expect(within(header).queryByTestId("notification-badge")).toBeNull()

    await flushEffects()
  })

  it("does not render a badge when there are no unread notifications", async () => {
    updateNotificationCount(0)

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

    // flush pending effects/microtasks, then assert the badge never rendered
    await act(async () => {})

    const header = screen.getByTestId("notification-header")
    expect(within(header).queryByTestId("notification-badge")).toBeNull()

    await flushEffects()
  })

  it("Renders user info", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    const elements = await screen.findAllByText("test1@blink.sv")
    expect(elements.length).toBeGreaterThan(0)

    await flushEffects()
  })

  it("shows the restricted-region banner while the region is restricted", async () => {
    mockIsRestrictedRegion = true

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    expect(await screen.findByTestId("restricted-region-banner")).toBeTruthy()

    await flushEffects()
  })

  it("hides the restricted-region banner outside a restricted region", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.queryByTestId("restricted-region-banner")).toBeNull()
  })

  /** While sanctioned the group is gated behind DisabledFeature, which takes its
   *  children out of the accessibility tree and stands in for them: the label only
   *  resolves to a pressable while the gate is on. */
  it("gates Ways to get paid behind the sanctions modal while restricted", async () => {
    mockIsRestrictedRegion = true

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    const gate = await screen.findByLabelText("Ways to get paid")
    fireEvent.press(gate)

    expect(mockPresentRestrictedRegionModal).toHaveBeenCalledTimes(1)
    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()

    await flushEffects()
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

    await flushEffects()
  })

  it("hides phone ln address when phone is missing", async () => {
    testState.phone = null

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    // flush pending effects/microtasks, then assert on the settled output
    await act(async () => {})

    expect(screen.queryByText("Set your lightning address")).toBeNull()
    expect(screen.queryByText("+50365055539@blink.sv")).toBeNull()

    await flushEffects()
  })

  it("truncates long settings row titles", async () => {
    const longTitle = "This is a very long settings row title that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} />
      </ContextForScreen>,
    )
    await flushEffects()

    const titleNode = screen.getByText(longTitle)
    expect(titleNode.props.numberOfLines).toBe(1)
    expect(titleNode.props.ellipsizeMode).toBe("tail")
  })

  it("truncates long settings row subtitles", async () => {
    const longTitle = "Short title"
    const longSubtitle = "This is a very long subtitle that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle} />
      </ContextForScreen>,
    )
    await flushEffects()

    const subtitleNode = screen.getByText(longSubtitle)
    expect(subtitleNode.props.numberOfLines).toBe(1)
    expect(subtitleNode.props.ellipsizeMode).toBe("tail")
  })

  it("truncates long title and subtitle together", async () => {
    const longTitle = "Another very long settings row title that should truncate"
    const longSubtitle = "Another very long subtitle that should truncate"

    render(
      <ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle} />
      </ContextForScreen>,
    )
    await flushEffects()

    const titleNode = screen.getByText(longTitle)
    const subtitleNode = screen.getByText(longSubtitle)
    expect(titleNode.props.numberOfLines).toBe(1)
    expect(titleNode.props.ellipsizeMode).toBe("tail")
    expect(subtitleNode.props.numberOfLines).toBe(1)
    expect(subtitleNode.props.ellipsizeMode).toBe("tail")
  })

  it("renders the Move to non-custodial option for a custodial account", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    // let the migration-checkpoint load settle so the row leaves its skeleton state
    await flushEffects()

    expect(screen.getByText("Move to non-custodial")).toBeTruthy()
  })

  it("renders the Fee rates option", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByText("Fee rates")).toBeTruthy()
  })

  it("does not render a standalone Recovery method group", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    // flush pending effects/microtasks, then assert on the settled output
    await act(async () => {})

    expect(screen.queryByTestId("Recovery method-group")).toBeNull()

    await flushEffects()
  })

  it("shows the Advanced group with CSV export and API access for a custodial account", async () => {
    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByTestId("Advanced-group")).toBeTruthy()
    expect(screen.getByText("Export all transactions")).toBeTruthy()
    expect(screen.getByText("API integration")).toBeTruthy()
  })

  it("shows CSV export without API access for a self-custodial account", async () => {
    mockAccountRegistryOverride.activeAccount = {
      id: "sc-1",
      type: AccountType.SelfCustodial,
    }

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(screen.getByTestId("Advanced-group")).toBeTruthy()
    expect(screen.getByText("Export all transactions")).toBeTruthy()
    expect(screen.queryByText("API integration")).toBeNull()
  })

  it("skips the unread-notifications query when not authenticated", async () => {
    mockUseIsAuthed.mockReturnValue(false)
    const generated = jest.requireMock("@app/graphql/generated")
    generated.useUnacknowledgedNotificationCountQuery.mockClear()

    render(
      <ContextForScreen>
        <SettingsScreen />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(generated.useUnacknowledgedNotificationCountQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )

    await flushEffects()
  })

  it("runs the unread-notifications query when authenticated", async () => {
    mockUseIsAuthed.mockReturnValue(true)
    const generated = jest.requireMock("@app/graphql/generated")
    generated.useUnacknowledgedNotificationCountQuery.mockClear()

    render(
      <ContextForScreen>
        <SettingsScreen />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(generated.useUnacknowledgedNotificationCountQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: false }),
    )

    await flushEffects()
  })
})

describe("Settings Screen Anon gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsAnonMode = false
    mockUseIsAuthed.mockReturnValue(true)
  })

  it("leaves the Ways-to-get-paid group open outside Anon mode", async () => {
    render(
      <ContextForScreen>
        <SettingsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(screen.queryByLabelText("Ways to get paid")).toBeNull()
  })

  it("gates the Ways-to-get-paid group in Anon mode", async () => {
    mockIsAnonMode = true

    render(
      <ContextForScreen>
        <SettingsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    /** The gated rows leave the accessibility tree; the gate stands in by name. */
    expect(screen.getByLabelText("Ways to get paid")).toBeTruthy()
  })

  it("routes a tap on the gated group to the Enhanced prompt", async () => {
    mockIsAnonMode = true

    render(
      <ContextForScreen>
        <SettingsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByLabelText("Ways to get paid"))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
  })
})
