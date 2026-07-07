import React from "react"
import { render, act } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"

const mockUseActiveApiKeys = jest.fn()
const mockUseCustodialMigrationRequired = jest.fn()
const mockApiServiceScreen = jest.fn((_props: { onContinue: () => void }) => null)
const mockRequiredScreen = jest.fn(
  (_props: { mode: string; onClose?: () => void }) => null,
)

jest.mock("@app/screens/account-migration/hooks", () => ({
  useActiveApiKeys: () => mockUseActiveApiKeys(),
}))

jest.mock("@app/hooks/use-custodial-migration-required", () => ({
  useCustodialMigrationRequired: () => mockUseCustodialMigrationRequired(),
}))

jest.mock("@app/screens/account-migration/to-non-custodial/api-service-screen", () => ({
  MigrationApiServiceScreen: (props: { onContinue: () => void }) =>
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
    mockUseCustodialMigrationRequired.mockReturnValue(false)
  })

  it("renders neither screen while the API-key check is loading", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: true })

    render(<MigrationGate />)

    expect(mockApiServiceScreen).not.toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("shows the API-service warning when there are active API keys", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: true, loading: false })

    render(<MigrationGate />)

    expect(mockApiServiceScreen).toHaveBeenCalled()
    expect(mockRequiredScreen).not.toHaveBeenCalled()
  })

  it("shows the required screen directly when there are no active API keys", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: false })

    render(<MigrationGate />)

    expect(mockRequiredScreen).toHaveBeenCalled()
    expect(mockApiServiceScreen).not.toHaveBeenCalled()
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
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: false })
    mockUseCustodialMigrationRequired.mockReturnValue(false)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("voluntary")
  })

  it("uses the forced pre-deadline mode when migration is required", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: false })
    mockUseCustodialMigrationRequired.mockReturnValue(true)

    render(<MigrationGate />)

    expect(mockRequiredScreen.mock.calls[0][0].mode).toBe("forcedPreDeadline")
  })

  it("forwards onClose to the required screen", () => {
    mockUseActiveApiKeys.mockReturnValue({ hasActiveApiKeys: false, loading: false })
    const onClose = jest.fn()

    render(<MigrationGate onClose={onClose} />)

    expect(mockRequiredScreen.mock.calls[0][0].onClose).toBe(onClose)
  })
})
