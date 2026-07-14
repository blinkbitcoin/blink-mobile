import React from "react"
import { render, act } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"

import { walletOverviewQueryResult } from "../helpers"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockIsFocused = true
const mockUseActiveApiKeys = jest.fn()
const mockUseCustodialMigrationRequired = jest.fn()
const mockUseMigrationGateArmed = jest.fn()
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

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => mockIsFocused,
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { colors: { primary: "#fb5607" } } }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useActiveApiKeys: () => mockUseActiveApiKeys(),
  useWindDownGateArmed: () => mockUseMigrationGateArmed(),
}))

jest.mock("@app/hooks/use-custodial-migration-required", () => ({
  useCustodialMigrationRequired: () => mockUseCustodialMigrationRequired(),
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

describe("MigrationGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
    mockUseCustodialMigrationRequired.mockReturnValue(false)
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: false })
    mockUseMigrationGateArmed.mockReturnValue(false)
    mockUseTransferBlocked.mockReturnValue(false)
    mockUseDollarBalanceRestricted.mockReturnValue(false)
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 0 }),
    )
  })

  it("holds a loading screen while the API-key check loads", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: true })

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

  it("treats missing wallet data as a zero dollar balance", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ loading: false, data: undefined })

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalled()
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

  it("dismisses through onClose instead of goBack when the blocker provides it", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    const onClose = jest.fn()

    render(<MigrationGate onClose={onClose} />)
    const { toggleModal } = mockDollarBalanceModal.mock.calls[0][0]

    act(() => {
      toggleModal()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("skips the dollar-balance check after the gate arms, where the flow converts dollars", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockUseMigrationGateArmed.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).not.toHaveBeenCalled()
    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("shows the API-service warning when there are active API keys", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })

    render(<MigrationGate />)

    expect(mockApiServiceScreen).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("checks the dollar balance before the API keys", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ usdBalance: 20 }),
    )
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })

    render(<MigrationGate />)

    expect(mockDollarBalanceModal).toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
  })

  it("shows the required screen directly when there are no active API keys", () => {
    render(<MigrationGate />)

    expect(mockRequiredScreen).toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
  })

  it("closes the API-service warning through goBack on the voluntary route", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })

    render(<MigrationGate />)
    const { onClose } = mockApiServiceScreen.mock.calls[0][0]

    act(() => {
      onClose?.()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("closes the API-service warning through the blocker's onClose when provided", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })
    const onClose = jest.fn()

    render(<MigrationGate onClose={onClose} />)
    const apiProps = mockApiServiceScreen.mock.calls[0][0]

    act(() => {
      apiProps.onClose?.()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("keeps the API-service warning unclosable after the gate arms", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })
    mockUseMigrationGateArmed.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockApiServiceScreen.mock.calls[0][0].onClose).toBeUndefined()
  })

  it("moves on to the required screen once the API warning is acknowledged", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })

    render(<MigrationGate />)
    const { onContinue } = mockApiServiceScreen.mock.calls[0][0]

    act(() => {
      onContinue()
    })

    expect(mockRequiredScreen).toHaveBeenCalled()
  })

  it("uses the voluntary mode when migration is not required", () => {
    mockUseCustodialMigrationRequired.mockReturnValue(false)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("voluntary")
  })

  it("uses the gate mode when the post-deadline gate is armed", () => {
    mockUseMigrationGateArmed.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("gate")
  })

  it("prefers the gate mode over the forced one", () => {
    mockUseMigrationGateArmed.mockReturnValue(true)
    mockUseCustodialMigrationRequired.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("gate")
  })

  it("uses the forced pre-deadline mode when migration is required", () => {
    mockUseCustodialMigrationRequired.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("forcedPreDeadline")
  })

  it("forwards onClose to the required screen", () => {
    const onClose = jest.fn()

    render(<MigrationGate onClose={onClose} />)

    expect(mockRequiredScreen.mock.calls[0][0].onClose).toBe(onClose)
  })
})
