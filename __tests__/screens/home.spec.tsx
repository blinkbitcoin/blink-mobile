import React from "react"
import { it } from "@jest/globals"
import { MockedResponse } from "@apollo/client/testing"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { HomeScreen } from "../../app/screens/home-screen"
import { ContextForScreen } from "./helper"
import { flushEffects } from "../helpers/flush-effects"
import {
  AccountLevel,
  HomeAuthedDocument,
  HomeUnauthedDocument,
  Network,
} from "@app/graphql/generated"
import { mockCurrencyList } from "@app/graphql/mocks"

let currentMocks: MockedResponse[] = []

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockBackupNudgeState = {
  shouldShowBanner: false,
  shouldShowModal: false,
  shouldShowSettingsBanner: false,
  dismissBanner: jest.fn(),
}
jest.mock("@app/hooks/use-backup-nudge-state", () => ({
  useBackupNudgeState: () => mockBackupNudgeState,
}))

type NudgeModalProps = { isVisible: boolean; onClose: () => void }
const mockBackupNudgeModal = jest.fn<null, [NudgeModalProps]>(() => null)
jest.mock("@app/components/backup-nudge-modal", () => ({
  BackupNudgeModal: (props: NudgeModalProps) => mockBackupNudgeModal(props),
}))

let mockIsFocused = true

// eslint-disable-next-line prefer-const
let mockActiveWalletOverride: Record<string, unknown> | null = null
// eslint-disable-next-line prefer-const
let mockFeatureFlagsOverride: Record<string, unknown> | null = null
// eslint-disable-next-line prefer-const
let mockSelfCustodialWalletOverride: Record<string, unknown> | null = null
const mockToggleBalanceMode = jest.fn()
// eslint-disable-next-line prefer-const
let mockBalanceModeValue: "btc" | "usd" = "usd"
let mockDollarBalanceRestrictedOverride = false
let mockTransferBlockedOverride = false
let mockDollarBalanceModalVisible = false

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () =>
    mockActiveWalletOverride ?? {
      wallets: [],
      status: "unavailable",
      accountType: "custodial",
      isReady: false,
      isSelfCustodial: false,
      needsBackendAuth: true,
    },
}))

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")
  return {
    ...actual,
    useFeatureFlags: () =>
      mockFeatureFlagsOverride ?? {
        nonCustodialEnabled: false,
        stableBalanceEnabled: false,
      },
    useRemoteConfig: () => ({
      loading: false,
      remoteConfigReady: true,
      feeReimbursementMemo: "fee reimbursement",
      featureFlags: {
        nonCustodialEnabled: false,
        stableBalanceEnabled: false,
      },
      custodialDollarBalanceBlockedCountries: [],
      selfCustodialDollarBalanceBlockedCountries: [],
    }),
  }
})

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlocked: () => mockTransferBlockedOverride,
  useTransferBlockedSync: () => undefined,
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockDollarBalanceRestrictedOverride,
  useDollarBalanceRestrictionSync: () => undefined,
}))

jest.mock("@app/hooks/use-stablesats-forced-conversion", () => ({
  useStablesatsForcedConversion: ({
    isRestricted,
    usdWalletBalance,
  }: {
    isRestricted: boolean
    usdWalletBalance: number
  }) => ({
    isConvertModalVisible: isRestricted && usdWalletBalance > 0,
    closeConvertModal: jest.fn(),
  }),
}))

jest.mock("@app/components/dollar-balance-restriction-modal", () => {
  const ReactActual = jest.requireActual("react")
  const { Text } = jest.requireActual("react-native")
  return {
    DollarBalanceRestrictionModal: ({ isVisible }: { isVisible: boolean }) => {
      mockDollarBalanceModalVisible = isVisible
      return ReactActual.createElement(
        Text,
        { testID: "dollar-balance-restriction-modal" },
        "dollar-balance-restriction",
      )
    },
  }
})

jest.mock("@app/components/usd-convert-to-btc-modal", () => {
  const ReactActual = jest.requireActual("react")
  const { View, Text } = jest.requireActual("react-native")
  return {
    UsdConvertToBtcModal: ({
      isVisible,
      usdWalletBalance,
    }: {
      isVisible: boolean
      usdWalletBalance: { amount: number }
    }) =>
      isVisible
        ? ReactActual.createElement(
            View,
            { testID: "convert-modal" },
            ReactActual.createElement(Text, null, String(usdWalletBalance.amount)),
          )
        : null,
  }
})

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () =>
    mockSelfCustodialWalletOverride ?? {
      sdk: null,
      wallets: [],
      status: "unavailable",
      isStableBalanceActive: false,
      lastReceivedPaymentId: null,
      hasMoreTransactions: false,
      loadingMore: false,
      loadMore: jest.fn(),
      refreshWallets: jest.fn(),
      refreshStableBalanceActive: jest.fn(),
      retry: jest.fn(),
    },
}))

jest.mock("@app/hooks/use-balance-mode", () => {
  const BalanceMode = { Btc: "btc", Usd: "usd" } as const
  return {
    BalanceMode,
    useBalanceMode: () => ({
      mode: mockBalanceModeValue,
      setMode: jest.fn(),
      toggleMode: mockToggleBalanceMode,
      loaded: true,
    }),
  }
})

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  isIos: true,
}))

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")

  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmount: ({ amount }: { amount: number }) => ({
        amount,
        currency: "DisplayCurrency",
        currencyCode: "USD",
      }),
    }),
  }
})

jest.mock("@app/graphql/mocks", () => {
  const actual = jest.requireActual("@app/graphql/mocks")
  return {
    __esModule: true,
    mockCurrencyList: actual.mockCurrencyList,
    get default() {
      // Spec-specific mocks first so they take precedence (they are
      // infinite-use, so the shared variants of the same queries are never
      // reached); the shared mocks backfill every other query fired by
      // mounted components, keeping Apollo's MockLink warning-free.
      return [...currentMocks, ...actual.default]
    },
  }
})

jest.mock("@app/components/slide-up-handle", () => {
  const React = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")

  type Props = {
    onAction: () => void
    testID?: string
  }

  const MockSlideUpHandle = ({ onAction, testID = "slide-up-handle" }: Props) => (
    <TouchableOpacity testID={testID} onPress={onAction}>
      <Text>Slide up</Text>
    </TouchableOpacity>
  )

  return { __esModule: true, default: MockSlideUpHandle }
})

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: mockNavigate,
    }),
    useIsFocused: () => mockIsFocused,
  }
})

jest.mock("@react-native-firebase/app-check", () => {
  return () => ({
    initializeAppCheck: jest.fn(),
    getToken: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: jest.fn(),
    }),
  })
})

jest.mock("react-native-config", () => {
  return {
    APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
    APP_CHECK_IOS_DEBUG_TOKEN: "token",
  }
})

export const generateHomeMock = ({
  level,
  network,
  btcBalance,
  usdBalance,
}: {
  level: AccountLevel
  network: Network
  btcBalance: number
  usdBalance: number
}): MockedResponse[] => {
  return [
    {
      request: { query: HomeUnauthedDocument },
      maxUsageCount: Number.POSITIVE_INFINITY,
      result: {
        data: {
          __typename: "Query",
          globals: {
            __typename: "Globals",
            network,
          },
          // Must match the shared currencyList mock, or Apollo warns about
          // cache data loss when the two results replace each other.
          currencyList: mockCurrencyList,
        },
      },
    },
    {
      request: { query: HomeAuthedDocument },
      maxUsageCount: Number.POSITIVE_INFINITY,
      result: {
        data: {
          me: {
            __typename: "User",
            id: "user-id",
            language: "en",
            username: "test-user",
            phone: "+50365055539",
            email: {
              __typename: "Email",
              address: null,
              verified: false,
            },
            defaultAccount: {
              __typename: "ConsumerAccount",
              id: "account-id",
              level,
              defaultWalletId: "btc-wallet",
              wallets: [
                {
                  __typename: "BTCWallet",
                  id: "btc-wallet",
                  balance: btcBalance,
                  walletCurrency: "BTC",
                },
                {
                  __typename: "UsdWallet",
                  id: "usd-wallet",
                  balance: usdBalance,
                  walletCurrency: "USD",
                },
              ],
              transactions: {
                __typename: "TransactionConnection",
                edges: [],
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: false,
                  hasPreviousPage: false,
                  startCursor: null,
                  endCursor: null,
                },
              },
              pendingIncomingTransactions: [],
            },
          },
        },
      },
    },
  ]
}

type ConvertButtonCase = {
  description: string
  isIos: boolean
  level: AccountLevel
  network: Network
  btcBalance: number
  usdBalance: number
  expectConvertButton: boolean
}

const iosCases: ConvertButtonCase[] = [
  {
    description: "iOS + mainnet + ONE + no balance --> hidden",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: false,
  },
  {
    description: "iOS + mainnet + ONE + has balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 1000,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + mainnet + TWO + no balance --> shown",
    isIos: true,
    level: AccountLevel.Two,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + mainnet + THREE + no balance --> shown",
    isIos: true,
    level: AccountLevel.Three,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + signet + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Signet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + regtest + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Regtest,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + testnet + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Testnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
]

const androidCases: ConvertButtonCase[] = [
  {
    description: "Android + signet + ONE + no balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Signet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "Android + regtest + ONE + has balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Regtest,
    btcBalance: 0,
    usdBalance: 5000,
    expectConvertButton: true,
  },
  {
    description: "Android + signet + TWO + has balance --> shown",
    isIos: false,
    level: AccountLevel.Two,
    network: Network.Signet,
    btcBalance: 2000,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "Android + regtest + THREE + has balance --> shown",
    isIos: false,
    level: AccountLevel.Three,
    network: Network.Regtest,
    btcBalance: 3000,
    usdBalance: 3000,
    expectConvertButton: true,
  },
  {
    description: "Android + mainnet + ONE + no balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
]

describe("HomeScreen", () => {
  beforeEach(() => {
    currentMocks = []
    mockActiveWalletOverride = null
    mockDollarBalanceRestrictedOverride = false
    mockTransferBlockedOverride = false
    mockDollarBalanceModalVisible = false
    jest.clearAllMocks()
  })

  it("renders home screen for custodial user", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByTestId("slide-up-handle")).toBeTruthy()
  })

  it.each([...iosCases, ...androidCases] satisfies ConvertButtonCase[])(
    "%s",
    async ({ isIos, level, network, btcBalance, usdBalance, expectConvertButton }) => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos,
      }))

      currentMocks = generateHomeMock({ level, network, btcBalance, usdBalance })

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      if (expectConvertButton) {
        await waitFor(() => expect(getByTestId("transfer")).toBeTruthy())
        await flushEffects()
        return
      }

      await waitFor(() => expect(() => getByTestId("transfer")).toThrow())

      await flushEffects()
    },
  )

  it("hides the transfer button when transfers are blocked", async () => {
    mockTransferBlockedOverride = true
    currentMocks = generateHomeMock({
      level: AccountLevel.Two,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())
    await flushEffects()
  })

  it("auto-opens the convert modal when a restricted account holds a Dollar balance", async () => {
    mockDollarBalanceRestrictedOverride = true
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { findByTestId, getByText } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("convert-modal")).toBeTruthy()
    expect(getByText("5000")).toBeTruthy()

    await flushEffects()
  })

  it("does not auto-open the convert modal when the restricted account has no Dollar balance", async () => {
    mockDollarBalanceRestrictedOverride = true
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("convert-modal")).toBeNull()
  })

  it("shows the dollar-balance restriction modal and skips forced conversion for self-custodial", async () => {
    mockDollarBalanceRestrictedOverride = true
    mockActiveWalletOverride = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
        {
          id: "usd-1",
          walletCurrency: "USD",
          balance: { amount: 5000, currency: "USD", currencyCode: "USD" },
          transactions: [],
        },
      ],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { getByTestId, queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByTestId("dollar-balance-restriction-modal")).toBeTruthy()
    expect(queryByTestId("convert-modal")).toBeNull()

    mockActiveWalletOverride = null
  })

  it("opens the dollar-balance restriction modal from the disabled transfer button", async () => {
    mockDollarBalanceRestrictedOverride = true
    mockActiveWalletOverride = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
        {
          id: "usd-1",
          walletCurrency: "USD",
          balance: { amount: 5000, currency: "USD", currencyCode: "USD" },
          transactions: [],
        },
      ],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    // Transfers are not blocked, so the button is rendered but disabled.
    expect(getByTestId("transfer")).toBeTruthy()
    expect(mockDollarBalanceModalVisible).toBe(false)

    fireEvent.press(getByTestId("transfer"))

    expect(mockDollarBalanceModalVisible).toBe(true)

    mockActiveWalletOverride = null
  })

  it("Slide-up handle triggers navigation to transaction history", async () => {
    mockNavigate.mockClear()

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByTestId("slide-up-handle"))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("transactionHistory"))

    await flushEffects()
  })

  it("renders home screen for self-custodial user", async () => {
    mockActiveWalletOverride = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
        {
          id: "usd-1",
          walletCurrency: "USD",
          balance: { amount: 0, currency: "USD", currencyCode: "USD" },
          transactions: [],
        },
      ],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByTestId("slide-up-handle")).toBeTruthy()

    mockActiveWalletOverride = null
  })

  it("never renders the trust-model modal for self-custodial users with balance", async () => {
    mockActiveWalletOverride = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 5000, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }

    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 5000,
      usdBalance: 0,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("trust-model-modal")).toBeNull()

    mockActiveWalletOverride = null
  })

  describe("Stable Balance mode toggle (self-custodial)", () => {
    const selfCustodialWallets = [
      {
        id: "btc-1",
        walletCurrency: "BTC",
        balance: { amount: 5517, currency: "BTC", currencyCode: "BTC" },
        transactions: [],
      },
      {
        id: "usd-1",
        walletCurrency: "USD",
        balance: { amount: 100, currency: "USD", currencyCode: "USD" },
        transactions: [],
      },
    ]

    beforeEach(() => {
      mockToggleBalanceMode.mockClear()
      mockActiveWalletOverride = {
        wallets: selfCustodialWallets,
        status: "ready",
        accountType: "self-custodial",
        isReady: true,
        isSelfCustodial: true,
        needsBackendAuth: false,
      }
      mockSelfCustodialWalletOverride = {
        sdk: { id: "fake-sdk" },
        wallets: selfCustodialWallets,
        status: "ready",
        isStableBalanceActive: true,
        lastReceivedPaymentId: null,
        hasMoreTransactions: false,
        loadingMore: false,
        loadMore: jest.fn(),
        refreshWallets: jest.fn(),
        refreshStableBalanceActive: jest.fn(),
        retry: jest.fn(),
      }
    })

    afterEach(() => {
      mockActiveWalletOverride = null
      mockSelfCustodialWalletOverride = null
      mockFeatureFlagsOverride = null
      mockBalanceModeValue = "usd"
    })

    it("shows the balance mode toggle when SB is enabled and active", async () => {
      mockFeatureFlagsOverride = {
        nonCustodialEnabled: true,
        stableBalanceEnabled: true,
      }

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      await waitFor(() => expect(getByTestId("balance-mode-toggle")).toBeTruthy())

      await flushEffects()
    })

    it("hides the toggle when stableBalanceEnabled flag is off", async () => {
      mockFeatureFlagsOverride = {
        nonCustodialEnabled: true,
        stableBalanceEnabled: false,
      }

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      await flushEffects()
      expect(queryByTestId("balance-mode-toggle")).toBeNull()
    })

    it("hides the toggle when Stable Balance is inactive even if flag is on", async () => {
      mockFeatureFlagsOverride = {
        nonCustodialEnabled: true,
        stableBalanceEnabled: true,
      }
      mockSelfCustodialWalletOverride = {
        ...(mockSelfCustodialWalletOverride as Record<string, unknown>),
        isStableBalanceActive: false,
      }

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      await flushEffects()
      expect(queryByTestId("balance-mode-toggle")).toBeNull()
    })

    it("invokes toggleMode when the label is pressed", async () => {
      mockFeatureFlagsOverride = {
        nonCustodialEnabled: true,
        stableBalanceEnabled: true,
      }

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      const toggle = await waitFor(() => getByTestId("balance-mode-toggle"))
      fireEvent.press(toggle)

      expect(mockToggleBalanceMode).toHaveBeenCalledTimes(1)

      await flushEffects()
    })
  })

  describe("BackupNudgeModal focus gating", () => {
    const lastIsVisible = (): boolean => {
      const calls = mockBackupNudgeModal.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      return calls[calls.length - 1][0].isVisible
    }

    beforeEach(() => {
      mockBackupNudgeModal.mockClear()
      mockBackupNudgeState.shouldShowModal = false
      mockIsFocused = true
    })

    afterEach(() => {
      mockBackupNudgeState.shouldShowModal = false
      mockIsFocused = true
    })

    it("passes isVisible=true only when both isFocused and shouldShowModal are true", async () => {
      mockBackupNudgeState.shouldShowModal = true
      mockIsFocused = true

      render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(lastIsVisible()).toBe(true)
    })

    it("passes isVisible=false when the home tab is not focused", async () => {
      mockBackupNudgeState.shouldShowModal = true
      mockIsFocused = false

      render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(lastIsVisible()).toBe(false)
    })

    it("passes isVisible=false when the nudge state says it should not be shown", async () => {
      mockBackupNudgeState.shouldShowModal = false
      mockIsFocused = true

      render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(lastIsVisible()).toBe(false)
    })

    it("passes isVisible=false when neither condition is met", async () => {
      mockBackupNudgeState.shouldShowModal = false
      mockIsFocused = false

      render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(lastIsVisible()).toBe(false)
    })
  })

  describe("self-custodial balance loading (#3852)", () => {
    afterEach(() => {
      mockActiveWalletOverride = null
    })

    it("shows the loading state instead of $0.00 when the self-custodial balance failed to load", async () => {
      mockActiveWalletOverride = {
        wallets: [],
        status: "error",
        accountType: "self-custodial",
        isReady: false,
        isSelfCustodial: true,
        needsBackendAuth: false,
      }

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(queryByTestId("balance-value")).toBeNull()
    })

    it("keeps showing the balance when a later refresh goes offline and the wallets are retained", async () => {
      mockActiveWalletOverride = {
        wallets: [
          {
            id: "btc-1",
            walletCurrency: "BTC",
            balance: { amount: 5000, currency: "BTC", currencyCode: "BTC" },
            transactions: [],
          },
          {
            id: "usd-1",
            walletCurrency: "USD",
            balance: { amount: 0, currency: "USD", currencyCode: "USD" },
            transactions: [],
          },
        ],
        status: "offline",
        accountType: "self-custodial",
        isReady: false,
        isSelfCustodial: true,
        needsBackendAuth: false,
      }

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(getByTestId("balance-value")).toBeTruthy()
    })

    it("shows the loading state during an account switch, before the new wallets load", async () => {
      mockActiveWalletOverride = {
        wallets: [],
        status: "loading",
        accountType: "self-custodial",
        isReady: false,
        isSelfCustodial: true,
        needsBackendAuth: false,
      }

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(queryByTestId("balance-value")).toBeNull()
    })

    it("shows a zero balance, not a skeleton, for a ready account with no wallets", async () => {
      mockActiveWalletOverride = {
        wallets: [],
        status: "ready",
        accountType: "self-custodial",
        isReady: true,
        isSelfCustodial: true,
        needsBackendAuth: false,
      }

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(getByTestId("balance-value")).toBeTruthy()
    })
  })
})
