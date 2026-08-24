import React from "react"
import { it } from "@jest/globals"
import { MockedResponse } from "@apollo/client/testing"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { RefreshControl, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { HomeScreen } from "../../app/screens/home-screen"
import { ContextForScreen } from "./helper"
import { flushEffects } from "../helpers/flush-effects"
import {
  AccountLevel,
  HomeAuthedDocument,
  HomeUnauthedDocument,
  Network,
  useBulletinsQuery,
} from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { mockCurrencyList } from "@app/graphql/mocks"
import { ConvertDirection } from "@app/types/payment"
import { WindDownStatus } from "@app/types/wind-down"

let currentMocks: MockedResponse[] = []

jest.mock("@app/utils/ip-country-lookup")

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
  dismissModal: jest.fn(),
}
jest.mock("@app/self-custodial/hooks/use-backup-nudge-state", () => ({
  useBackupNudgeState: () => mockBackupNudgeState,
}))

type NudgeModalProps = { isVisible: boolean; onClose: () => void }
const mockBackupNudgeModal = jest.fn<null, [NudgeModalProps]>(() => null)
jest.mock("@app/components/backup-nudge-modal", () => ({
  BackupNudgeModal: (props: NudgeModalProps) => mockBackupNudgeModal(props),
}))

const mockSelfCustodialInfoBulletinState = {
  shouldShow: false,
  dismiss: jest.fn(),
}
jest.mock("@app/hooks/use-self-custodial-info-bulletin-state", () => ({
  useSelfCustodialInfoBulletinState: () => mockSelfCustodialInfoBulletinState,
}))

const mockSelfCustodialInfoBulletin = jest.fn<null, [{ onDismiss: () => void }]>(
  () => null,
)
jest.mock("@app/components/self-custodial-info-bulletin", () => ({
  SelfCustodialInfoBulletin: (props: { onDismiss: () => void }) =>
    mockSelfCustodialInfoBulletin(props),
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
let mockRegionPendingOverride = false
let mockTransferBlockedOverride = false
let mockTransferRegionPendingOverride = false
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

// eslint-disable-next-line prefer-const
let mockActiveAccountOverride: Record<string, unknown> | null = null

jest.mock("@app/hooks/use-account-registry", () => {
  const actual = jest.requireActual("@app/hooks/use-account-registry")
  return {
    ...actual,
    useAccountRegistry: () => {
      const registry = actual.useAccountRegistry()
      return mockActiveAccountOverride
        ? { ...registry, activeAccount: mockActiveAccountOverride }
        : registry
    },
  }
})

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual<typeof import("@app/config/feature-flags-context")>(
    "@app/config/feature-flags-context",
  )
  /**
   * Typed against the real hook and spread from the real defaults so tsc fails
   * when the mock misses a new remote-config key or keeps a removed one — a
   * stale partial mock crashed the whole suite when #3977 landed.
   */
  const remoteConfig: ReturnType<typeof actual.useRemoteConfig> = {
    ...actual.defaultRemoteConfig,
    selfCustodialDollarBalanceBlockedCountries: [],
  }
  return {
    ...actual,
    useFeatureFlags: () =>
      mockFeatureFlagsOverride ?? {
        nonCustodialEnabled: false,
        stableBalanceEnabled: false,
      },
    useRemoteConfig: () => remoteConfig,
  }
})

let mockIsAnonMode = false

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlocked: () => mockTransferBlockedOverride,
  useTransferGated: () => mockIsAnonMode || mockTransferBlockedOverride,
  useTransferGate: () => ({
    isGated: mockIsAnonMode || mockTransferBlockedOverride,
    isRegionPending: mockTransferRegionPendingOverride,
  }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockDollarBalanceRestrictedOverride,
  useDollarBalanceGated: () => mockIsAnonMode || mockDollarBalanceRestrictedOverride,
  useDollarBalanceGate: () => ({
    isGated: mockIsAnonMode || mockDollarBalanceRestrictedOverride,
    isRegionPending: mockRegionPendingOverride,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockPromptEnhancedMode = jest.fn()
let mockEnhancedModePromptVisible = false
jest.mock("@app/components/enhanced-mode-prompt", () => ({
  useEnhancedModePrompt: () => ({
    promptEnhancedMode: mockPromptEnhancedMode,
    isEnhancedModePromptVisible: mockEnhancedModePromptVisible,
  }),
}))

/** The screen arms the upgrade prompt on a 1500ms timer; a little slack keeps the
 *  test from racing the exact boundary. */
const UPGRADE_MODAL_DELAY_WITH_SLACK_MS = 2000

let mockIsRestrictedRegion = false
let mockIsRestrictedRegionEvaluationPending = false
let mockCanShowUpgradeModal = false
const mockPresentRestrictedRegionModal = jest.fn()
jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => ({
    isRestrictedRegion: mockIsRestrictedRegion,
    isRestrictedRegionEvaluationPending: mockIsRestrictedRegionEvaluationPending,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: mockPresentRestrictedRegionModal,
  }),
}))

const mockTrialAccountLimitsModal = jest.fn()
jest.mock("@app/components/upgrade-account-modal", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    TrialAccountLimitsModal: (props: { isVisible: boolean }) => {
      mockTrialAccountLimitsModal(props)
      return props.isVisible
        ? ReactActual.createElement(View, { testID: "trial-account-limits-modal" })
        : null
    },
  }
})

type ForcedConversionParams = {
  isRestricted: boolean
  usdWalletBalance: number
  minimumBalance: number | null
}
let mockForcedConversionParams: ForcedConversionParams | null = null

jest.mock("@app/hooks/use-dollar-balance-forced-conversion", () => ({
  useDollarBalanceForcedConversion: (params: ForcedConversionParams) => {
    mockForcedConversionParams = params
    return {
      isConvertModalVisible: params.isRestricted && params.usdWalletBalance > 0,
      closeConvertModal: jest.fn(),
    }
  },
}))

let mockMigratePromptVisible = false
let mockCanReopen = false
const mockDismissMigratePrompt = jest.fn()
const mockReopenMigratePrompt = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-migrate-now-prompt", () => ({
  useMigrateNowPrompt: () => ({
    isVisible: mockMigratePromptVisible,
    canReopen: mockCanReopen,
    deadlineTimestamp: 1787003999,
    timezone: "Europe/Paris",
    dismissForSession: mockDismissMigratePrompt,
    reopen: mockReopenMigratePrompt,
  }),
}))

const mockMigrateNowModal = jest.fn()

jest.mock("@app/components/migrate-now-modal", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    MigrateNowModal: (props: {
      isVisible: boolean
      onMigrate: () => void
      toggleModal: () => void
    }) => {
      mockMigrateNowModal(props)
      /** Always mounted now, toggled by isVisible: mirror the real modal so a hidden
       *  instance is absent from the tree, as the "not shown" assertions expect. */
      return props.isVisible
        ? ReactActual.createElement(View, { testID: "migrate-now-modal" })
        : null
    },
  }
})

let mockReminderBulletinVisible = false
let mockReminderBulletinPhase: WindDownStatus = WindDownStatus.PreCutoff

jest.mock("@app/screens/account-migration/hooks/use-migration-reminder-bulletin", () => ({
  useMigrationReminderBulletin: () => ({
    isVisible: mockReminderBulletinVisible,
    phase: mockReminderBulletinPhase,
    deadlineTimestamp: 1787003999,
    receiveDisabledTimestamp: 1785189600,
    timezone: "Europe/Paris",
  }),
}))

let mockReceiveBlocked = false

jest.mock("@app/screens/account-migration/hooks/use-wind-down-receive-blocked", () => ({
  useWindDownReceiveBlocked: () => mockReceiveBlocked,
}))

const mockMigrationReminderBulletin = jest.fn()

jest.mock("@app/components/migration-reminder-bulletin", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    MigrationReminderBulletin: (props: { onMigrate: () => void }) => {
      mockMigrationReminderBulletin(props)
      return ReactActual.createElement(View, { testID: "migration-reminder-bulletin" })
    },
  }
})

const mockUseNonCustodialConversionLimits = jest.fn()
let mockPendingDepositsOverride: {
  deposits: unknown[]
  refetch?: () => Promise<void>
} | null = null

jest.mock("@app/self-custodial/hooks", () => {
  const actual = jest.requireActual("@app/self-custodial/hooks")
  return {
    ...actual,
    useNonCustodialConversionLimits: (direction: string | undefined) =>
      mockUseNonCustodialConversionLimits(direction),
    usePendingDeposits: () =>
      mockPendingDepositsOverride
        ? { refetch: async () => {}, ...mockPendingDepositsOverride }
        : actual.usePendingDeposits(),
  }
})

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

jest.mock("@app/screens/conversion-flow/stable-token-convert-to-btc-modal", () => {
  const ReactActual = jest.requireActual("react")
  const { View, Text } = jest.requireActual("react-native")
  return {
    StableTokenConvertToBtcModal: ({
      isVisible,
      usdWalletBalance,
    }: {
      isVisible: boolean
      usdWalletBalance: { amount: number }
    }) =>
      isVisible
        ? ReactActual.createElement(
            View,
            { testID: "sc-convert-modal" },
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
    /** Clears the cooldown so the auto-present path depends only on the guards
     *  under test rather than on session bookkeeping. */
    useAutoShowUpgradeModal: () => ({
      canShowUpgradeModal: mockCanShowUpgradeModal,
      lastShownUpgradeModalAt: null,
      markShownUpgradeModal: jest.fn(),
      resetUpgradeModal: jest.fn(),
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

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    /** Passthrough spy: the real query still runs against MockedProvider; the spy
     *  only records call args so the bulletins auth skip-gate can be asserted. */
    useBulletinsQuery: jest.fn((opts: unknown) => actual.useBulletinsQuery(opts)),
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
  pendingIncomingTransactions = [],
  defaultAccountMissing = false,
}: {
  level: AccountLevel
  network: Network
  btcBalance: number
  usdBalance: number
  pendingIncomingTransactions?: Array<Record<string, unknown>>
  defaultAccountMissing?: boolean
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
            defaultAccount: defaultAccountMissing
              ? null
              : {
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
                  pendingIncomingTransactions,
                },
          },
        },
      },
    },
  ]
}

/** Unconfirmed onchain deposit, shaped to the full Transaction fragment so the
 *  Apollo cache accepts it without data-loss warnings. */
const pendingOnchainReceiveTx = {
  __typename: "Transaction",
  id: "pending-onchain-receive-1",
  status: "PENDING",
  direction: "RECEIVE",
  memo: null,
  createdAt: 1678093528,
  settlementAmount: 50_000,
  settlementFee: 0,
  settlementDisplayFee: "0.00",
  settlementCurrency: "BTC",
  settlementDisplayAmount: "500.00",
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    base: 10320000000000,
    offset: 12,
    currencyUnit: "USDCENT",
    formattedAmount: "10.32",
    __typename: "Price",
  },
  initiationVia: {
    __typename: "InitiationViaOnChain",
    address: "bc1q-pending-deposit-address",
  },
  settlementVia: {
    __typename: "SettlementViaOnChain",
    transactionHash: "pending-tx-hash",
    arrivalInMempoolEstimatedAt: null,
  },
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

const selfCustodialReadyWalletOverride = (usdBalance: number) => ({
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
      balance: { amount: usdBalance, currency: "USD", currencyCode: "USD" },
      transactions: [],
    },
  ],
  status: "ready",
  accountType: "self-custodial",
  isReady: true,
  isSelfCustodial: true,
  needsBackendAuth: false,
})

type RestrictionInvariantCase = {
  description: string
  restricted: boolean
  transferBlocked: boolean
  level: AccountLevel
  btcBalance: number
  expectButton: "disabled" | "enabled" | "hidden"
}

// Invariant: a dollar-restricted account must always see the transfer button
// (disabled, opening the restriction modal) so the greyed-out dollar row has
// an explanation path. The only exception is the iOS zero-balance gate.
const restrictionInvariantCases: RestrictionInvariantCase[] = [
  {
    description:
      "dollar restricted + transfers blocked --> transfer button shown but disabled",
    restricted: true,
    transferBlocked: true,
    level: AccountLevel.Two,
    btcBalance: 1000,
    expectButton: "disabled",
  },
  {
    description:
      "dollar restricted + transfers allowed --> transfer button shown but disabled",
    restricted: true,
    transferBlocked: false,
    level: AccountLevel.Two,
    btcBalance: 1000,
    expectButton: "disabled",
  },
  {
    description: "dollar restricted + iOS zero-balance gate --> transfer button hidden",
    restricted: true,
    transferBlocked: false,
    level: AccountLevel.One,
    btcBalance: 0,
    expectButton: "hidden",
  },
  {
    description:
      "dollar restricted + transfers blocked + iOS zero-balance gate --> transfer button hidden",
    restricted: true,
    transferBlocked: true,
    level: AccountLevel.One,
    btcBalance: 0,
    expectButton: "hidden",
  },
  {
    description:
      "dollar active + transfers blocked + iOS zero-balance gate --> transfer button hidden",
    restricted: false,
    transferBlocked: true,
    level: AccountLevel.One,
    btcBalance: 0,
    expectButton: "hidden",
  },
  {
    description: "dollar active + transfers allowed --> transfer button enabled",
    restricted: false,
    transferBlocked: false,
    level: AccountLevel.Two,
    btcBalance: 1000,
    expectButton: "enabled",
  },
]

const runRestrictionInvariantCase = async ({
  restricted,
  transferBlocked,
  level,
  btcBalance,
  expectButton,
}: RestrictionInvariantCase) => {
  mockDollarBalanceRestrictedOverride = restricted
  mockTransferBlockedOverride = transferBlocked
  // usdBalance stays 0 so the forced-conversion modal never auto-opens
  currentMocks = generateHomeMock({
    level,
    network: Network.Mainnet,
    btcBalance,
    usdBalance: 0,
  })

  const { getByTestId } = render(
    <ContextForScreen>
      <HomeScreen />
    </ContextForScreen>,
  )

  if (expectButton === "hidden") {
    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())
    await flushEffects()
    return
  }

  /** A gated button leaves the accessibility tree, so it is only reachable to a query
   *  that includes hidden elements; the press still routes up to the gate. */
  const findTransfer = () =>
    expectButton === "disabled"
      ? getByTestId("transfer", { includeHiddenElements: true })
      : getByTestId("transfer")

  await waitFor(() => expect(findTransfer()).toBeTruthy())
  await flushEffects()
  fireEvent.press(findTransfer())

  if (expectButton === "disabled") {
    expect(mockDollarBalanceModalVisible).toBe(true)
    expect(mockNavigate).not.toHaveBeenCalledWith("conversionDetails")
  } else {
    expect(mockNavigate).toHaveBeenCalledWith("conversionDetails")
    expect(mockDollarBalanceModalVisible).toBe(false)
  }
}

const resetHomeScreenMocks = () => {
  currentMocks = []
  /** Focus gates the badge auto-seen timers, so a suite that unfocuses the screen must
   *  not decide what the next one sees. */
  mockIsFocused = true
  mockActiveWalletOverride = null
  mockActiveAccountOverride = null
  mockDollarBalanceRestrictedOverride = false
  mockRegionPendingOverride = false
  mockTransferRegionPendingOverride = false
  mockMigratePromptVisible = false
  mockEnhancedModePromptVisible = false
  mockCanReopen = false
  mockReceiveBlocked = false
  mockReminderBulletinVisible = false
  mockReminderBulletinPhase = WindDownStatus.PreCutoff
  mockTransferBlockedOverride = false
  mockDollarBalanceModalVisible = false
  mockForcedConversionParams = null
  mockIsAnonMode = false
  mockIsRestrictedRegion = false
  mockIsRestrictedRegionEvaluationPending = false
  mockCanShowUpgradeModal = false
  jest.clearAllMocks()
  mockUseNonCustodialConversionLimits.mockReturnValue({
    limits: null,
    loading: false,
    error: null,
  })
}

// eslint-disable-next-line max-lines-per-function -- one screen's suite, sharing the mock reset above; splitting solely to meet the line cap would scatter cases that are read together
describe("HomeScreen", () => {
  beforeEach(resetHomeScreenMocks)

  it("renders home screen for custodial user", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByTestId("slide-up-handle")).toBeTruthy()
  })

  it("renders when the authed response is temporarily missing defaultAccount", async () => {
    // Right after device-account creation, /me can resolve before defaultAccount
    // does; a throw here left the app crashing on every reopen (#4082)
    currentMocks = generateHomeMock({
      level: AccountLevel.Zero,
      network: Network.Mainnet,
      btcBalance: 0,
      usdBalance: 0,
      defaultAccountMissing: true,
    })

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByTestId("slide-up-handle")).toBeTruthy()
  })

  it("excludes the bottom safe-area edge the tab bar already reserves", async () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getAllByType } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    const edges = UNSAFE_getAllByType(SafeAreaView).map((view) => view.props.edges)
    expect(edges).toContainEqual(["top", "left", "right"])
    expect(edges).not.toContainEqual(expect.arrayContaining(["bottom"]))
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

  it.each(restrictionInvariantCases)("$description", runRestrictionInvariantCase)

  it("auto-opens the convert modal when a restricted account holds a Dollar balance", async () => {
    mockDollarBalanceRestrictedOverride = true
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { findByTestId, getByText, queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("convert-modal")).toBeTruthy()
    expect(getByText("5000")).toBeTruthy()
    expect(queryByTestId("sc-convert-modal")).toBeNull()

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

  it("forces the self-custodial conversion when a restricted account holds a stable-token balance", async () => {
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

    const { findByTestId, getByTestId, getByText, queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("sc-convert-modal")).toBeTruthy()
    expect(getByText("5000")).toBeTruthy()
    expect(queryByTestId("convert-modal")).toBeNull()
    expect(getByTestId("dollar-balance-restriction-modal")).toBeTruthy()

    await flushEffects()

    mockActiveWalletOverride = null
  })

  it("does not force the self-custodial conversion without a stable-token balance", async () => {
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

    expect(queryByTestId("sc-convert-modal")).toBeNull()

    mockActiveWalletOverride = null
  })

  it("shows neither convert modal in the account-switch window, while the SDK still connects", async () => {
    mockDollarBalanceRestrictedOverride = true
    /** Right after switching to self-custodial: the restriction already applies
     *  the self-custodial policy (accountType) but the SDK has not connected yet
     *  (isSelfCustodial false), and the custodial query data is still cached. */
    mockActiveWalletOverride = {
      wallets: [],
      status: "unavailable",
      accountType: "self-custodial",
      isReady: false,
      isSelfCustodial: false,
      needsBackendAuth: false,
    }
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("convert-modal")).toBeNull()
    expect(queryByTestId("sc-convert-modal")).toBeNull()

    mockActiveWalletOverride = null
  })

  it("treats a self-custodial limits response without a minimum as any positive cent", async () => {
    mockDollarBalanceRestrictedOverride = true
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: { minFromAmount: null, minToAmount: null },
      loading: false,
      error: null,
    })
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(mockUseNonCustodialConversionLimits).toHaveBeenLastCalledWith(
      ConvertDirection.UsdToBtc,
    )
    /** Mirrors the bridge: a null `minFromAmount` means "no minimum, allow",
     *  so the forced-conversion trigger must not read it as "unknown". */
    expect(mockForcedConversionParams?.minimumBalance).toBe(1)

    mockActiveWalletOverride = null
  })

  it("skips the limits fetch while the home screen is unfocused", async () => {
    mockIsFocused = false
    mockDollarBalanceRestrictedOverride = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(mockUseNonCustodialConversionLimits).toHaveBeenLastCalledWith(undefined)

    mockIsFocused = true
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

    // Transfers are not blocked, so the gate is rendered in the button's place.
    expect(getByTestId("transfer", { includeHiddenElements: true })).toBeTruthy()
    expect(mockDollarBalanceModalVisible).toBe(false)

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockDollarBalanceModalVisible).toBe(true)

    mockActiveWalletOverride = null
  })

  it("opens the Enhanced Mode prompt from the disabled transfer button in Anon mode", async () => {
    mockIsAnonMode = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
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

    expect(getByTestId("transfer", { includeHiddenElements: true })).toBeTruthy()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
    expect(mockDollarBalanceModalVisible).toBe(false)

    mockActiveWalletOverride = null
  })

  it("keeps the transfer button inert and unexplained while the region is still resolving", async () => {
    mockRegionPendingOverride = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
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

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockNavigate).not.toHaveBeenCalledWith("conversionDetails")
    expect(mockDollarBalanceModalVisible).toBe(false)
    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()

    mockActiveWalletOverride = null
  })

  /**
   * The region decides the dollar figure and nothing else, but one shared loader carried the
   * whole header. A self-custodial user has no phone number, so the country comes from an IP
   * lookup walking its adapters: holding everything on it meant seconds of spinners over a
   * total, a username and a Bitcoin balance the app already had.
   */
  it("keeps the balance and the bitcoin row readable while the region is still resolving", async () => {
    mockRegionPendingOverride = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
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

    expect(getByTestId("balance-value")).toBeTruthy()
    expect(getByTestId("bitcoin-balance")).toBeTruthy()

    mockActiveWalletOverride = null
  })

  it("enables the transfer button once the pending region resolves to no restriction", async () => {
    mockRegionPendingOverride = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { getByTestId, rerender } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    mockRegionPendingOverride = false
    rerender(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(getByTestId("transfer"))

    expect(mockNavigate).toHaveBeenCalledWith("conversionDetails")

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
      mockBackupNudgeState.dismissModal.mockClear()
      mockBackupNudgeState.dismissBanner.mockClear()
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

    // #4156: closing the modal used to write the banner's dismissal key, which the
    // modal never reads — so the prompt reopened on the same render and trapped users.
    it("closes through the modal's own dismissal, not the banner's", async () => {
      mockBackupNudgeState.shouldShowModal = true
      mockIsFocused = true

      render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      const calls = mockBackupNudgeModal.mock.calls
      calls[calls.length - 1][0].onClose()

      expect(mockBackupNudgeState.dismissModal).toHaveBeenCalled()
      expect(mockBackupNudgeState.dismissBanner).not.toHaveBeenCalled()
    })
  })
})
describe("HomeScreen transfer-region gating", () => {
  beforeEach(resetHomeScreenMocks)

  const transferButtonMocks = () =>
    generateHomeMock({
      level: AccountLevel.Two,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

  it("holds the transfer button off the row while the transfer region is pending", async () => {
    mockTransferRegionPendingOverride = true
    currentMocks = transferButtonMocks()

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    /** Reading the unresolved region as allowed would offer the button and then take it
     *  away once the verdict lands in a transfer-blocked country. */
    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())
    await flushEffects()
  })

  it("keeps the transfer button off the row when the pending region settles blocked", async () => {
    mockTransferRegionPendingOverride = true
    currentMocks = transferButtonMocks()

    const { getByTestId, rerender } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())

    mockTransferRegionPendingOverride = false
    mockTransferBlockedOverride = true
    rerender(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())
    await flushEffects()
  })

  it("shows the transfer button once the pending region settles allowed", async () => {
    mockTransferRegionPendingOverride = true
    currentMocks = transferButtonMocks()

    const { getByTestId, rerender } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(() => getByTestId("transfer")).toThrow())

    mockTransferRegionPendingOverride = false
    rerender(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByTestId("transfer")).toBeTruthy())
    await flushEffects()
  })
})

describe("HomeScreen self-custodial balance loading (#3852)", () => {
  beforeEach(resetHomeScreenMocks)

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

describe("SelfCustodialInfoBulletin gating", () => {
  beforeEach(() => {
    currentMocks = []
    mockActiveWalletOverride = null
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: false,
      error: null,
    })
    mockSelfCustodialInfoBulletinState.shouldShow = false
  })

  afterEach(() => {
    mockSelfCustodialInfoBulletinState.shouldShow = false
    mockActiveWalletOverride = null
  })

  const renderForSelfCustodial = () => {
    mockActiveWalletOverride = {
      wallets: [],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    return render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
  }

  it("renders the bulletin when the hook says it should show", async () => {
    mockSelfCustodialInfoBulletinState.shouldShow = true

    renderForSelfCustodial()
    await flushEffects()

    expect(mockSelfCustodialInfoBulletin).toHaveBeenCalled()
  })

  it("does not render the bulletin when the hook says it should not show", async () => {
    renderForSelfCustodial()
    await flushEffects()

    expect(mockSelfCustodialInfoBulletin).not.toHaveBeenCalled()
  })
})

describe("HomeScreen wind-down states", () => {
  beforeEach(() => {
    currentMocks = []
    mockActiveWalletOverride = null
    mockDollarBalanceRestrictedOverride = false
    mockMigratePromptVisible = false
    mockCanReopen = false
    mockReceiveBlocked = false
    mockReminderBulletinVisible = false
    mockReminderBulletinPhase = WindDownStatus.PreCutoff
    mockTransferBlockedOverride = false
    mockDollarBalanceModalVisible = false
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: false,
      error: null,
    })
  })

  it("pushes the migrate-now prompt when receiving is disabled", async () => {
    mockMigratePromptVisible = true

    const { findByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("migrate-now-modal")).toBeTruthy()

    await flushEffects()
  })

  it("keeps the migrate-now prompt hidden while nothing disables receiving", async () => {
    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("migrate-now-modal")).toBeNull()
  })

  /** Two native modals cannot present at once on iOS, so the Enhanced prompt has to
   *  suppress the migrate-now push like every other home modal. */
  it("lets the Enhanced prompt outrank the migrate-now prompt", async () => {
    mockMigratePromptVisible = true
    mockEnhancedModePromptVisible = true

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("migrate-now-modal")).toBeNull()
  })

  it("shows the migrate-now prompt once the Enhanced prompt closes", async () => {
    mockMigratePromptVisible = true
    mockEnhancedModePromptVisible = false

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("migrate-now-modal")).toBeTruthy()
  })

  it("lets the forced conversion outrank the migrate-now prompt", async () => {
    mockMigratePromptVisible = true
    mockDollarBalanceRestrictedOverride = true
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { findByTestId, queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("convert-modal")).toBeTruthy()
    expect(queryByTestId("migrate-now-modal")).toBeNull()

    await flushEffects()
  })

  it("enters the migration flow from the migrate-now prompt, dismissing it first", async () => {
    mockMigratePromptVisible = true

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const { onMigrate } = mockMigrateNowModal.mock.calls[0][0]
    onMigrate()

    expect(mockDismissMigratePrompt).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockDismissMigratePrompt.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    )
  })

  it("dismisses the prompt for the session from the modal close action", async () => {
    mockMigratePromptVisible = true

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const { toggleModal } = mockMigrateNowModal.mock.calls[0][0]
    toggleModal()

    expect(mockDismissMigratePrompt).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationEntry")
  })

  it("lets the dollar-restriction modal outrank the migrate-now prompt", async () => {
    mockMigratePromptVisible = true
    mockDollarBalanceRestrictedOverride = true
    /** A restricted account with no dollars left: the forced conversion never fires
     *  (nothing to convert), so this isolates the restriction modal outranking the
     *  migrate-now prompt when the disabled transfer button is pressed. */
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
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(await findByTestId("migrate-now-modal")).toBeTruthy()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockDollarBalanceModalVisible).toBe(true)
    expect(queryByTestId("migrate-now-modal")).toBeNull()

    mockActiveWalletOverride = null
  })

  it("greys out the receive action while receiving is disabled, reopening the prompt", async () => {
    mockCanReopen = true
    mockReceiveBlocked = true
    mockNavigate.mockClear()

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    fireEvent.press(getByTestId("receive", { includeHiddenElements: true }))

    expect(mockReopenMigratePrompt).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalledWith("receiveBitcoin")
  })

  it("keeps the receive action live while receiving stays enabled", async () => {
    mockNavigate.mockClear()
    mockActiveWalletOverride = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
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

    fireEvent.press(getByTestId("receive"))

    expect(mockNavigate).toHaveBeenCalledWith("receiveBitcoin")
    expect(mockReopenMigratePrompt).not.toHaveBeenCalled()

    mockActiveWalletOverride = null
  })

  const renderWithGatedDollarBalance = async () => {
    mockDollarBalanceRestrictedOverride = true
    // usdBalance stays 0 so the forced-conversion modal never auto-opens
    currentMocks = generateHomeMock({
      level: AccountLevel.Two,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

    const view = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()
    return view
  }

  /** The wind-down's only remedy has to be reachable from the surfaces the region gate
   *  greys out, since a user hunting for it will try them: the compliance modal they used
   *  to open is a title and a Close button, with nothing about the migration. The greyed
   *  dollar row is the other entry point and shares this exact callback (`onGatedTap`),
   *  whose wiring wallet-overview.spec covers. */
  it("reopens the migrate-now prompt from the disabled transfer button", async () => {
    mockCanReopen = true

    const { getByTestId } = await renderWithGatedDollarBalance()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockReopenMigratePrompt).toHaveBeenCalledTimes(1)
    expect(mockDollarBalanceModalVisible).toBe(false)
    expect(mockNavigate).not.toHaveBeenCalledWith("conversionDetails")
  })

  /** The gate also greys these surfaces for regions with no wind-down at all, and those
   *  accounts have no migration to be pushed into. */
  it("keeps the region explanation when no migrate-now prompt can surface", async () => {
    mockCanReopen = false

    const { getByTestId } = await renderWithGatedDollarBalance()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockDollarBalanceModalVisible).toBe(true)
    expect(mockReopenMigratePrompt).not.toHaveBeenCalled()
  })

  it("shows the migration reminder bulletin in the pre-cutoff phase", async () => {
    mockReminderBulletinVisible = true

    const { findByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("migration-reminder-bulletin")).toBeTruthy()

    await flushEffects()
  })

  /** The dashboard entry the dismissible migrate-now modal leaves behind once closed. */
  it("keeps the migration reminder bulletin once receiving is disabled", async () => {
    mockReminderBulletinVisible = true
    mockReminderBulletinPhase = WindDownStatus.ReceiveDisabled

    const { findByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("migration-reminder-bulletin")).toBeTruthy()

    await flushEffects()
  })

  it("forwards the wind-down phase so the bulletin can pick its copy", async () => {
    mockReminderBulletinVisible = true
    mockReminderBulletinPhase = WindDownStatus.ReceiveDisabled

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const { phase } = mockMigrationReminderBulletin.mock.calls[0][0]
    expect(phase).toBe(WindDownStatus.ReceiveDisabled)
  })

  it("keeps the reminder bulletin hidden in a phase that does not call for it", async () => {
    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("migration-reminder-bulletin")).toBeNull()
  })

  it("enters the migration flow from the reminder bulletin", async () => {
    mockReminderBulletinVisible = true

    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const { onMigrate } = mockMigrationReminderBulletin.mock.calls[0][0]
    onMigrate()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
  })
})

describe("HomeScreen pending receive badge", () => {
  beforeEach(() => {
    resetHomeScreenMocks()
    // The unseen-tx badge only auto-dismisses on a focused screen, and it owns
    // the same slot as the pending row — earlier suites leave this false.
    mockIsFocused = true
  })

  const mocksWithPendingDeposit = () =>
    generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
      pendingIncomingTransactions: [pendingOnchainReceiveTx],
    })

  /** The pending row and the unseen-tx badge share one slot under the balance:
   *  a freshly arrived receive is announced by the transient badge first, and
   *  the pending row takes the slot back when that window closes — the hand-back
   *  itself is pinned in use-badge-slot-content.spec, which can drive its
   *  timers. */
  it("yields the badge slot to the unseen-tx badge as the receive arrives", async () => {
    currentMocks = mocksWithPendingDeposit()

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(queryByTestId("pending-receive-badge")).toBeNull()
  })

  it("hides the badge while nothing is pending", async () => {
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

    expect(queryByTestId("pending-receive-badge")).toBeNull()
  })

  describe("self-custodial", () => {
    const selfCustodialWallet = {
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    const sparkDeposit = (status: string) => ({
      id: "abc:0",
      txid: "abc",
      vout: 0,
      amount: { amount: 50_000, currency: "BTC", currencyCode: "BTC" },
      status,
      errorReason: null,
    })
    const selfCustodialActiveAccount = {
      id: "self-custodial-default",
      type: "self-custodial",
      label: "Self-custodial",
      selected: true,
      status: "available",
    }

    beforeEach(() => {
      mockActiveAccountOverride = selfCustodialActiveAccount
    })

    afterEach(() => {
      mockActiveWalletOverride = null
      mockActiveAccountOverride = null
      mockPendingDepositsOverride = null
    })

    /** The slot sits directly under the balance the placeholder replaces, so the deposit
     *  amount must not spell out the figure the user just covered. */
    it("hides the pending row while amounts are hidden", async () => {
      mockActiveWalletOverride = selfCustodialWallet
      mockPendingDepositsOverride = { deposits: [sparkDeposit("immature")] }

      const { queryByTestId } = render(
        <HideAmountContextProvider
          value={{ hideAmount: true, toggleHideAmount: jest.fn() }}
        >
          <ContextForScreen>
            <HomeScreen />
          </ContextForScreen>
        </HideAmountContextProvider>,
      )

      await flushEffects()

      expect(queryByTestId("pending-receive-badge")).toBeNull()
    })

    it("shows the badge for an immature (unconfirmed) Spark deposit", async () => {
      mockActiveWalletOverride = selfCustodialWallet
      mockPendingDepositsOverride = { deposits: [sparkDeposit("immature")] }

      const { findByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      expect(await findByTestId("pending-receive-badge")).toBeTruthy()

      await flushEffects()
    })

    /** The regression in blink-wip#937: the only pending signal at the top was
     *  the unseen-tx badge, which auto-dismisses after ~5s. This row is
     *  state-driven and must outlive that window. */
    it("keeps the pending row past the unseen-badge auto-dismiss window", async () => {
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      try {
        mockActiveWalletOverride = selfCustodialWallet
        mockPendingDepositsOverride = { deposits: [sparkDeposit("immature")] }

        const { findByTestId, getByTestId } = render(
          <ContextForScreen>
            <HomeScreen />
          </ContextForScreen>,
        )

        expect(await findByTestId("pending-receive-badge")).toBeTruthy()

        // 5s auto-seen delay + 180ms hide-to-mark gap + slack
        act(() => {
          jest.advanceTimersByTime(30_000)
        })

        expect(getByTestId("pending-receive-badge")).toBeTruthy()

        await flushEffects()
      } finally {
        jest.useRealTimers()
      }
    })

    it("ignores custodial pending receives while the Spark SDK is still connecting", async () => {
      // Account registry: self-custodial. Wallet: still Unavailable, so the
      // useActiveWallet predicate reports isSelfCustodial=false and the home
      // query is NOT skipped — its pendingIncomingTransactions must not
      // produce a pill beside the self-custodial balance.
      mockActiveWalletOverride = {
        wallets: [],
        status: "unavailable",
        accountType: "self-custodial",
        isReady: false,
        isSelfCustodial: false,
        needsBackendAuth: false,
      }
      currentMocks = mocksWithPendingDeposit()

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      await flushEffects()

      expect(queryByTestId("pending-receive-badge")).toBeNull()
    })

    it("opens the unclaimed-deposits screen when the immature-deposit pill is tapped", async () => {
      // The banner no longer counts immature deposits, so the pill carries
      // their inspection path (txid / mempool link) to that screen.
      mockActiveWalletOverride = selfCustodialWallet
      mockPendingDepositsOverride = { deposits: [sparkDeposit("immature")] }

      const { findByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      fireEvent.press(await findByTestId("pending-receive-badge"))

      expect(mockNavigate).toHaveBeenCalledWith("unclaimedDepositsScreen")

      await flushEffects()
    })

    it("leaves the badge to the unclaimed-deposit banner for claimable deposits", async () => {
      mockActiveWalletOverride = selfCustodialWallet
      mockPendingDepositsOverride = { deposits: [sparkDeposit("claimable")] }

      const { queryByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      await flushEffects()

      expect(queryByTestId("pending-receive-badge")).toBeNull()
    })
  })
})

describe("HomeScreen pull-to-refresh", () => {
  beforeEach(resetHomeScreenMocks)

  /** iOS renders a programmatically-pinned UIRefreshControl as a frozen,
   *  non-spinning spinner. The control must reflect only user-initiated pulls
   *  (which the gesture animates natively), never background query loading —
   *  binding it to `loading` pinned a dead spinner on every mount and forever
   *  while a self-custodial wallet connects. */
  it("does not pin the refresh spinner while queries load in the background", async () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)

    await flushEffects()

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)
  })

  it("spins only for the duration of a user-initiated refresh", async () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    act(() => {
      UNSAFE_getByType(RefreshControl).props.onRefresh()
    })

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true)

    await waitFor(() =>
      expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false),
    )
  })

  /** A failed pull (offline is routine) must unpin the spinner and must not
   *  escape as an unhandled rejection — RefreshControl ignores the promise. */
  it("recovers the spinner when the refresh fails", async () => {
    mockActiveWalletOverride = {
      wallets: [],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    mockSelfCustodialWalletOverride = {
      sdk: null,
      wallets: [],
      status: "ready",
      isStableBalanceActive: false,
      lastReceivedPaymentId: null,
      hasMoreTransactions: false,
      loadingMore: false,
      loadMore: jest.fn(),
      refreshWallets: jest.fn().mockRejectedValue(new Error("offline")),
      refreshStableBalanceActive: jest.fn(),
      retry: jest.fn(),
    }
    try {
      // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
      const { UNSAFE_getByType } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await act(async () => {
        await expect(
          UNSAFE_getByType(RefreshControl).props.onRefresh(),
        ).resolves.toBeUndefined()
      })

      expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)
    } finally {
      mockActiveWalletOverride = null
      mockSelfCustodialWalletOverride = null
    }
  })

  it("refreshes the pending deposits before a self-custodial pull retracts", async () => {
    const refetchDeposits = jest.fn().mockResolvedValue(undefined)
    mockActiveWalletOverride = {
      wallets: [],
      status: "ready",
      accountType: "self-custodial",
      isReady: true,
      isSelfCustodial: true,
      needsBackendAuth: false,
    }
    mockPendingDepositsOverride = { deposits: [], refetch: refetchDeposits }
    try {
      // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
      const { UNSAFE_getByType } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      await act(async () => {
        await UNSAFE_getByType(RefreshControl).props.onRefresh()
      })

      expect(refetchDeposits).toHaveBeenCalledTimes(1)
    } finally {
      mockActiveWalletOverride = null
      mockPendingDepositsOverride = null
    }
  })
})

describe("bulletins auth gating", () => {
  const mockUseBulletinsQuery = useBulletinsQuery as jest.Mock

  beforeEach(() => {
    currentMocks = []
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: false,
      error: null,
    })
  })

  it("requests bulletins when authed", async () => {
    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockUseBulletinsQuery).toHaveBeenCalled()
    expect(mockUseBulletinsQuery.mock.lastCall[0]).toEqual(
      expect.objectContaining({ skip: false, variables: { first: 1 } }),
    )
  })

  /** Regression lock: campaign bulletins are never fetched for unauthenticated
   *  sessions — delivery is gated on auth alone, never on account state such as
   *  a lightning address. */
  it("skips bulletins query when not authed", async () => {
    render(
      <ContextForScreen>
        <IsAuthedContextProvider value={false}>
          <HomeScreen />
        </IsAuthedContextProvider>
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockUseBulletinsQuery).toHaveBeenCalled()
    expect(mockUseBulletinsQuery.mock.lastCall[0].skip).toBe(true)
  })
})

describe("HomeScreen layout under font scaling (blink-wip#931)", () => {
  beforeEach(() => {
    currentMocks = []
    mockActiveWalletOverride = null
    jest.clearAllMocks()
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: null,
      loading: false,
      error: null,
    })
  })

  it("pads the scroll content so the last bulletin clears the slide-up handle", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const contentStyle = StyleSheet.flatten(
      getByTestId("home-screen").props.contentContainerStyle,
    )
    // The SlideUpHandle overlays the bottom 97pt (82pt touch area + 15pt offset);
    // content must clear it so the last bulletin is readable at max scroll.
    expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(97)
  })

  it("lets the header area grow with content instead of clipping at a fixed height", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    const headerStyle = StyleSheet.flatten(getByTestId("home-header").props.style)
    expect(headerStyle.height).toBeUndefined()
    expect(headerStyle.maxHeight).toBeUndefined()
    expect(headerStyle.minHeight).toBeGreaterThanOrEqual(40)
  })

  it("sizes the header row to its content so it cannot collapse under the min height", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    // flex: 1 gives the row a zero flex-basis, so its content would stop
    // contributing to the auto-height parent and clip again at minHeight.
    const rowStyle = StyleSheet.flatten(getByTestId("home-header-row").props.style)
    expect(rowStyle.flex).toBeUndefined()
  })

  it("keeps the settings menu button wired in the header", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    fireEvent.press(getByTestId("home-settings-button"))

    expect(mockNavigate).toHaveBeenCalledWith("settings")
  })

  it("caps username font scaling so the header controls stay reachable", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    await waitFor(() => expect(getByTestId("home-username")).toBeTruthy())
    expect(getByTestId("home-username").props.maxFontSizeMultiplier).toBeLessThanOrEqual(
      1.5,
    )
  })
})

describe("useRemoteConfig mock completeness", () => {
  it("covers every real remote-config key so a new key cannot crash unrelated tests", () => {
    const actual = jest.requireActual<typeof import("@app/config/feature-flags-context")>(
      "@app/config/feature-flags-context",
    )
    const mocked = jest.requireMock<typeof import("@app/config/feature-flags-context")>(
      "@app/config/feature-flags-context",
    )

    const missingKeys = Object.keys(actual.defaultRemoteConfig).filter(
      (key) => !(key in mocked.useRemoteConfig()),
    )

    expect(missingKeys).toEqual([])
  })
})

describe("HomeScreen restricted region", () => {
  beforeEach(resetHomeScreenMocks)

  it("opens the restricted-region modal from the disabled transfer button when sanctioned", async () => {
    mockIsRestrictedRegion = true
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

    expect(getByTestId("transfer", { includeHiddenElements: true })).toBeTruthy()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockPresentRestrictedRegionModal).toHaveBeenCalledTimes(1)
    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()
    expect(mockDollarBalanceModalVisible).toBe(false)
  })

  /** Sanctions are the stricter layer: a sanctioned session must not be pushed into a
   *  migration whose destination it may not be allowed to reach either. */
  it("prefers the sanctions modal over the migrate-now nudge when both would apply", async () => {
    mockIsRestrictedRegion = true
    mockCanReopen = true
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 0,
    })

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockPresentRestrictedRegionModal).toHaveBeenCalledTimes(1)
    expect(mockReopenMigratePrompt).not.toHaveBeenCalled()
  })

  it("prefers the Enhanced prompt over the sanctions modal when both would apply", async () => {
    mockIsAnonMode = true
    mockIsRestrictedRegion = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
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

    fireEvent.press(getByTestId("transfer", { includeHiddenElements: true }))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
    expect(mockPresentRestrictedRegionModal).not.toHaveBeenCalled()

    mockActiveWalletOverride = null
  })

  it("suppresses the forced conversion while the region is sanctioned", async () => {
    mockIsRestrictedRegion = true
    mockDollarBalanceRestrictedOverride = true
    mockActiveWalletOverride = selfCustodialReadyWalletOverride(5000)
    currentMocks = generateHomeMock({
      level: AccountLevel.One,
      network: Network.Mainnet,
      btcBalance: 1000,
      usdBalance: 5000,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(mockForcedConversionParams?.isRestricted).toBe(false)
    expect(queryByTestId("sc-convert-modal")).toBeNull()

    mockActiveWalletOverride = null
  })
})

describe("HomeScreen sanctioned session", () => {
  beforeEach(resetHomeScreenMocks)

  const levelZeroWithBalance = () =>
    generateHomeMock({
      level: AccountLevel.Zero,
      network: Network.Mainnet,
      // Above the 2100-sat remote-config floor that arms the upgrade prompt
      btcBalance: 5000,
      usdBalance: 0,
    })

  const renderAndSettleUpgradeDelay = async () => {
    const view = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    /** The focus effect re-arms its timer whenever triggerUpgradeModal changes
     *  identity, which it does as the queries resolve. Settle, advance, then
     *  settle and advance again so the final timer is the one that fires. */
    await flushEffects()
    await act(async () => {
      jest.advanceTimersByTime(UPGRADE_MODAL_DELAY_WITH_SLACK_MS)
    })
    await flushEffects()
    await act(async () => {
      jest.advanceTimersByTime(UPGRADE_MODAL_DELAY_WITH_SLACK_MS)
    })
    return view
  }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] })
    mockCanShowUpgradeModal = true
    currentMocks = levelZeroWithBalance()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Control for the two guards below: without it a broken setup would make them
   *  pass for the wrong reason. */
  it("auto-presents the trial upgrade modal on an unrestricted level-zero account", async () => {
    const { queryByTestId } = await renderAndSettleUpgradeDelay()

    expect(queryByTestId("trial-account-limits-modal")).toBeTruthy()
  })

  it("keeps the upgrade modal away while the region is restricted", async () => {
    mockIsRestrictedRegion = true

    const { queryByTestId } = await renderAndSettleUpgradeDelay()

    expect(queryByTestId("trial-account-limits-modal")).toBeNull()
  })

  /** The late-verdict case: the splash cap can reveal Home before the lookup settles,
   *  and a modal presented in that window would end up behind the full-screen block. */
  it("keeps the upgrade modal away while the region verdict is still pending", async () => {
    mockIsRestrictedRegionEvaluationPending = true

    const { queryByTestId } = await renderAndSettleUpgradeDelay()

    expect(queryByTestId("trial-account-limits-modal")).toBeNull()
  })

  it("suppresses the migrate-now prompt while the region is restricted", async () => {
    mockMigratePromptVisible = true
    mockIsRestrictedRegion = true

    const { queryByTestId } = await renderAndSettleUpgradeDelay()

    expect(queryByTestId("migrate-now-modal")).toBeNull()
  })

  it("suppresses the migrate-now prompt while the region verdict is still pending", async () => {
    mockMigratePromptVisible = true
    mockIsRestrictedRegionEvaluationPending = true

    const { queryByTestId } = await renderAndSettleUpgradeDelay()

    expect(queryByTestId("migrate-now-modal")).toBeNull()
  })
})
