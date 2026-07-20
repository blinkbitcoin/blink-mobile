import React from "react"
import { render, act } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"
import { WindDown, WindDownStatus } from "@app/types/wind-down"

import { walletOverviewQueryResult } from "../helpers"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockIsFocused = true
const mockUseActiveApiKeys = jest.fn()
let mockWindDown: WindDown | null = null
const mockUseTransferBlocked = jest.fn()
const mockUseDollarBalanceRestricted = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockApiServiceScreen = jest.fn(
  (_props: { onContinue: () => void; onClose?: () => void }) => null,
)
const mockRequiredScreen = jest.fn(
  (_props: { mode: string; onClose?: () => void }) => null,
)
const mockDollarBalanceModal = jest.fn(
  (_props: { isVisible: boolean; toggleModal: () => void; onTransfer?: () => void }) =>
    null,
)
const mockUnavailableScreen = jest.fn(() => null)
const mockPrimaryButton = jest.fn(
  (_props: { title: string; onPress: () => void }) => null,
)
let mockSelfCustodialDisabled = false

/** The api-keys hook now reports readiness and errors, not just loading; tests override
 *  only the fields they care about on top of a settled, no-keys default. */
const apiKeysState = (overrides: Record<string, unknown> = {}) => ({
  hasActiveApiKeys: false,
  loading: false,
  isReady: true,
  hasError: false,
  refetch: jest.fn(),
  ...overrides,
})

/** Only the status drives the intro mode, so the display fields stay fixed across cases. */
const windDownWith = (status: WindDownStatus): WindDown => ({
  status,
  receiveDisabledAt: 0,
  finalDeadline: 0,
  gateArmsAt: 0,
  timezone: "Europe/Paris",
})

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => mockIsFocused,
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { colors: { primary: "#fb5607", warning: "#f0a202" } } }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useActiveApiKeys: () => mockUseActiveApiKeys(),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-wind-down", () => ({
  useCustodialWindDown: () => mockWindDown,
}))

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlocked: () => mockUseTransferBlocked(),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockUseDollarBalanceRestricted(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/components/dollar-balance-migration-modal", () => ({
  DollarBalanceMigrationModal: (props: {
    isVisible: boolean
    toggleModal: () => void
    onTransfer?: () => void
  }) => mockDollarBalanceModal(props),
}))

jest.mock("@app/screens/account-migration/to-non-custodial/api-service-screen", () => ({
  MigrationApiServiceScreen: (props: { onContinue: () => void; onClose?: () => void }) =>
    mockApiServiceScreen(props),
}))

jest.mock(
  "@app/screens/account-migration/to-non-custodial/migration-required-screen",
  () => ({
    MigrationRequiredScreen: (props: { mode: string; onClose?: () => void }) =>
      mockRequiredScreen(props),
  }),
)

jest.mock("@app/screens/account-migration/hooks/use-self-custodial-disabled", () => ({
  useSelfCustodialDisabled: () => mockSelfCustodialDisabled,
}))

jest.mock("@app/screens/feature-unavailable/temporarily-unavailable-screen", () => ({
  TemporarilyUnavailableScreen: () => mockUnavailableScreen(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: { generic: () => "generic error" },
      common: { tryAgain: () => "Try Again" },
    },
  }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: (props: { title: string; onPress: () => void }) =>
    mockPrimaryButton(props),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

describe("MigrationGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
    mockWindDown = null
    mockSelfCustodialDisabled = false
    mockUseActiveApiKeys.mockReturnValue(apiKeysState())
    mockUseTransferBlocked.mockReturnValue(false)
    mockUseDollarBalanceRestricted.mockReturnValue(false)
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 0 }),
    )
  })

  it("shows the temporarily-unavailable screen while the kill-switch is on, whatever the entry", () => {
    mockSelfCustodialDisabled = true
    mockWindDown = windDownWith(WindDownStatus.GatedClosed)
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)

    expect(mockUnavailableScreen).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
  })

  it("holds a loading screen while the API-key check loads", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ loading: true, isReady: false }))

    const { getByTestId } = render(<MigrationGate />)

    expect(getByTestId("migration-gate-loading")).toBeTruthy()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("holds a loading screen while the wallet balances load", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ loading: true, data: undefined })

    const { getByTestId } = render(<MigrationGate />)

    expect(getByTestId("migration-gate-loading")).toBeTruthy()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("waits instead of assuming zero when the wallet balance is not yet available", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ loading: false, data: undefined })

    const { getByTestId } = render(<MigrationGate />)

    expect(getByTestId("migration-gate-loading")).toBeTruthy()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
  })

  it("shows a retry instead of waving the user in when the API-keys query fails", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasError: true, isReady: false }))

    render(<MigrationGate />)

    expect(mockPrimaryButton).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
  })

  it("shows a retry instead of assuming zero when the balance query fails", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: jest.fn(),
    })

    render(<MigrationGate />)

    expect(mockPrimaryButton).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
  })

  it("refetches both queries when the retry button is pressed", () => {
    const refetchApiKeys = jest.fn()
    const refetchBalances = jest.fn()
    mockUseActiveApiKeys.mockReturnValue(
      apiKeysState({ hasError: true, isReady: false, refetch: refetchApiKeys }),
    )
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: refetchBalances,
    })

    render(<MigrationGate />)
    act(() => {
      mockPrimaryButton.mock.calls[0][0].onPress()
    })

    expect(refetchApiKeys).toHaveBeenCalledTimes(1)
    expect(refetchBalances).toHaveBeenCalledTimes(1)
  })

  it("blocks entry with the dollar-balance modal when the custodial Dollar Balance is above zero", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
  })

  it("keeps the required screen behind the dollar-balance modal instead of a blank background", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("shows the dollar-balance modal only while the gate has focus", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)

    expect(mockDollarBalanceModal.mock.calls[0][0].isVisible).toBe(true)
  })

  it("hides the dollar-balance modal while a pushed screen has focus", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockIsFocused = false

    render(<MigrationGate />)

    expect(mockDollarBalanceModal.mock.calls[0][0].isVisible).toBe(false)
  })

  it("offers the transfer action when the region permits the dollar transfer", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)
    const { onTransfer } = mockDollarBalanceModal.mock.calls[0][0]

    expect(onTransfer).toBeDefined()
    act(() => {
      onTransfer?.()
    })
    expect(mockNavigate).toHaveBeenCalledWith("conversionDetails")
  })

  it("shows the close-only variant when the region blocks the dollar transfer", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockUseTransferBlocked.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockDollarBalanceModal.mock.calls[0][0].onTransfer).toBeUndefined()
  })

  it("shows the close-only variant when the dollar balance is restricted in the region", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockUseDollarBalanceRestricted.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockDollarBalanceModal.mock.calls[0][0].onTransfer).toBeUndefined()
  })

  it("exits the flow when the dollar-balance modal is dismissed", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)
    const { toggleModal } = mockDollarBalanceModal.mock.calls[0][0]

    act(() => {
      toggleModal()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("skips the dollar-balance check after the gate arms, where the flow converts dollars", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockWindDown = windDownWith(WindDownStatus.GatedClosed)

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("shows the API-service warning when there are active API keys", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))

    render(<MigrationGate />)

    expect(mockApiServiceScreen).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("warns about the API keys before the dollar-balance check", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))

    render(<MigrationGate />)

    expect(mockApiServiceScreen).toHaveBeenCalled()
    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
  })

  it("shows the required screen directly when there are no active API keys", () => {
    render(<MigrationGate />)

    expect(mockRequiredScreen).toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
  })

  it("closes the API-service warning through goBack on the voluntary route", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))

    render(<MigrationGate />)
    const { onClose } = mockApiServiceScreen.mock.calls[0][0]

    act(() => {
      onClose?.()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("keeps the API-service warning unclosable after the gate arms", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))
    mockWindDown = windDownWith(WindDownStatus.GatedClosed)

    render(<MigrationGate />)

    expect(mockApiServiceScreen.mock.calls[0][0].onClose).toBeUndefined()
  })

  it("moves on to the required screen once the API warning is acknowledged", () => {
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))

    render(<MigrationGate />)
    const { onContinue } = mockApiServiceScreen.mock.calls[0][0]

    act(() => {
      onContinue()
    })

    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("uses the voluntary mode for an unaffected account with no wind-down", () => {
    mockWindDown = null

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("voluntary")
  })

  it("uses the gate mode once the account is closed", () => {
    mockWindDown = windDownWith(WindDownStatus.GatedClosed)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("gate")
  })

  it("uses the forced pre-deadline mode while the account is still before the cutoff", () => {
    mockWindDown = windDownWith(WindDownStatus.PreCutoff)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("forcedPreDeadline")
  })

  it("keeps the forced pre-deadline mode once receiving is disabled but before closure", () => {
    mockWindDown = windDownWith(WindDownStatus.ReceiveDisabled)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("forcedPreDeadline")
  })
})
