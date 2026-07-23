import React from "react"
import { render, act, fireEvent } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"
import { WindDown, WindDownStatus } from "@app/types/wind-down"

import { walletOverviewQueryResult } from "../helpers"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockIsFocused = true
const mockUseActiveApiKeys = jest.fn()
let mockWindDown: WindDown | null = null
let mockIsMigrationLocked = false
let mockLockLoading = false
let mockLockError = false
const mockRefetchLock = jest.fn()
let mockCheckpointLoading = false
const mockNavigateToCheckpoint = jest.fn()
const mockUseTransferBlocked = jest.fn()
const mockUseDollarBalanceRestricted = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockReportError = jest.fn()
/** The child mocks render a Pressable per action instead of returning null, so tests drive
 *  them with real fireEvent (which honours `disabled`) rather than calling captured props;
 *  the children stay mocked, so no real screen or its dependency tree is pulled in. */
const mockApiServiceScreen = jest.fn(
  (props: { onContinue: () => void; onClose?: () => void }) => {
    const { Pressable } = jest.requireActual("react-native")
    return (
      <>
        <Pressable testID="gate-api-continue" onPress={props.onContinue} />
        {props.onClose ? (
          <Pressable testID="gate-api-close" onPress={props.onClose} />
        ) : null}
      </>
    )
  },
)
const mockRequiredScreen = jest.fn(
  (_props: { mode: string; onClose?: () => void; isExitBlocked?: boolean }) => null,
)
const mockDollarBalanceModal = jest.fn(
  (props: { isVisible: boolean; toggleModal: () => void; onTransfer?: () => void }) => {
    const { Pressable } = jest.requireActual("react-native")
    return (
      <>
        <Pressable testID="gate-modal-dismiss" onPress={props.toggleModal} />
        {props.onTransfer ? (
          <Pressable testID="gate-modal-transfer" onPress={props.onTransfer} />
        ) : null}
      </>
    )
  },
)
const mockUnavailableScreen = jest.fn(() => null)
const mockPrimaryButton = jest.fn(
  (props: { title: string; onPress: () => void; disabled?: boolean }) => {
    const { Pressable, Text } = jest.requireActual("react-native")
    return (
      <Pressable
        testID="gate-retry-button"
        onPress={props.onPress}
        disabled={props.disabled}
        accessibilityState={{ disabled: Boolean(props.disabled) }}
      >
        <Text>{props.title}</Text>
      </Pressable>
    )
  },
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
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    loading: mockCheckpointLoading,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-wind-down", () => ({
  useCustodialWindDown: () => mockWindDown,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    isLocked: mockIsMigrationLocked,
    loading: mockLockLoading,
    hasError: mockLockError,
    refetch: mockRefetchLock,
  }),
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
    MigrationRequiredScreen: (props: {
      mode: string
      onClose?: () => void
      isExitBlocked?: boolean
    }) => mockRequiredScreen(props),
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

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

describe("MigrationGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
    mockWindDown = null
    mockSelfCustodialDisabled = false
    mockIsMigrationLocked = false
    mockLockLoading = false
    mockLockError = false
    mockCheckpointLoading = false
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

  it("refetches both queries when the retry button is pressed", async () => {
    const refetchApiKeys = jest.fn().mockResolvedValue(undefined)
    const refetchBalances = jest.fn().mockResolvedValue(undefined)
    mockUseActiveApiKeys.mockReturnValue(
      apiKeysState({ hasError: true, isReady: false, refetch: refetchApiKeys }),
    )
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: refetchBalances,
    })

    const { getByTestId } = render(<MigrationGate />)
    fireEvent.press(getByTestId("gate-retry-button"))
    await act(async () => {})

    expect(refetchApiKeys).toHaveBeenCalledTimes(1)
    expect(refetchBalances).toHaveBeenCalledTimes(1)
  })

  it("disables the retry button while a retry is in flight, re-enabling it after", async () => {
    let resolveRetry: () => void = () => {}
    const refetchApiKeys = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve
        }),
    )
    mockUseActiveApiKeys.mockReturnValue(
      apiKeysState({ hasError: true, isReady: false, refetch: refetchApiKeys }),
    )
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: jest.fn().mockResolvedValue(undefined),
    })

    const { getByTestId } = render(<MigrationGate />)
    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false }),
    )

    fireEvent.press(getByTestId("gate-retry-button"))
    await act(async () => {})
    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true }),
    )

    await act(async () => {
      resolveRetry()
    })
    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false }),
    )
  })

  /** A retry whose own refetch rejects must not fail silently: the rejection is reported
   *  and the button re-enables so the user can try again rather than being stuck on a
   *  spinner. */
  it("reports a retry whose refetch rejects and re-enables the button", async () => {
    const refetchApiKeys = jest.fn().mockRejectedValue(new Error("still offline"))
    mockUseActiveApiKeys.mockReturnValue(
      apiKeysState({ hasError: true, isReady: false, refetch: refetchApiKeys }),
    )
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      loading: false,
      error: new Error("network"),
      data: undefined,
      refetch: jest.fn().mockResolvedValue(undefined),
    })

    const { getByTestId } = render(<MigrationGate />)
    fireEvent.press(getByTestId("gate-retry-button"))
    await act(async () => {})

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration gate retry",
      expect.objectContaining({ message: "still offline" }),
    )
    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false }),
    )
  })

  it("refetches balances when the gate regains focus after the dollar transfer", () => {
    const refetchBalances = jest.fn().mockResolvedValue(undefined)
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ usdBalance: 20 }),
      refetch: refetchBalances,
    })

    const { rerender } = render(<MigrationGate />)
    expect(refetchBalances).not.toHaveBeenCalled()

    mockIsFocused = false
    rerender(<MigrationGate />)
    mockIsFocused = true
    rerender(<MigrationGate />)

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

    const { getByTestId } = render(<MigrationGate />)

    fireEvent.press(getByTestId("gate-modal-transfer"))

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

    const { getByTestId } = render(<MigrationGate />)

    fireEvent.press(getByTestId("gate-modal-dismiss"))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The backend rejects a migration whose USD wallet holds anything and never converts
   *  it, so letting the armed gate through would only move the refusal to a screen the
   *  user cannot leave. Every phase blocks on the same precondition. */
  it("blocks on the dollar balance after the gate arms too", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockWindDown = windDownWith(WindDownStatus.GatedClosed)

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).toHaveBeenCalled()
  })

  /** The intro exists to convince someone who has not started. The server already
   *  recorded this account as migrating, so it resumes instead of re-pitching. */
  it("resumes a locked migration at its checkpoint instead of showing the intro", () => {
    mockIsMigrationLocked = true

    render(<MigrationGate />)

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  /** The gate must not decide before it knows: rendering the intro while the lock is
   *  still in flight is what flashed the pitch at a user about to be resumed. */
  it("holds a loading screen while the lock is still in flight", () => {
    mockLockLoading = true

    const { getByTestId } = render(<MigrationGate />)

    expect(getByTestId("migration-gate-loading")).toBeTruthy()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  /** A failed lock read must block with a retry, not read as unlocked and re-pitch the intro
   *  to a user the server has already locked into the migration. */
  it("shows a retry instead of the intro when the lock read fails", () => {
    mockLockError = true

    render(<MigrationGate />)

    expect(mockPrimaryButton).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("refetches the lock too when the retry button is pressed", async () => {
    const refetchApiKeys = jest.fn().mockResolvedValue(undefined)
    const refetchBalances = jest.fn().mockResolvedValue(undefined)
    mockLockError = true
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ refetch: refetchApiKeys }))
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ usdBalance: 0 }),
      refetch: refetchBalances,
    })

    const { getByTestId } = render(<MigrationGate />)
    fireEvent.press(getByTestId("gate-retry-button"))
    await act(async () => {})

    expect(mockRefetchLock).toHaveBeenCalledTimes(1)
  })

  it("waits for the checkpoint to load before resuming a locked migration", () => {
    mockIsMigrationLocked = true
    mockCheckpointLoading = true

    render(<MigrationGate />)

    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  /**
   * The preconditions still outrank the resume: a Dollar Balance that arrived mid-flow
   * has to be emptied whatever the phase, or the commit is refused. The intro shows
   * behind the modal, in the wind-down's own mode, with no way out.
   */
  it("empties the dollars before resuming, even for a locked migration", () => {
    mockIsMigrationLocked = true
    mockWindDown = windDownWith(WindDownStatus.PreCutoff)
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )

    render(<MigrationGate />)

    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    expect(mockDollarBalanceModal).toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "forcedPreDeadline", isExitBlocked: true }),
    )
  })

  it("does not resume an account the server has not locked", () => {
    render(<MigrationGate />)

    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("leaves the way out open when nothing is locked or gated", () => {
    render(<MigrationGate />)

    expect(mockRequiredScreen).toHaveBeenCalledWith(
      expect.objectContaining({ isExitBlocked: false }),
    )
  })

  it("keeps the API-service warning unclosable for a locked migration", () => {
    mockIsMigrationLocked = true
    mockUseActiveApiKeys.mockReturnValue(apiKeysState({ hasActiveApiKeys: true }))

    render(<MigrationGate />)

    expect(mockApiServiceScreen).toHaveBeenCalledWith(
      expect.objectContaining({ onClose: undefined }),
    )
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

    const { getByTestId } = render(<MigrationGate />)

    fireEvent.press(getByTestId("gate-api-close"))

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

    const { getByTestId } = render(<MigrationGate />)

    fireEvent.press(getByTestId("gate-api-continue"))

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
