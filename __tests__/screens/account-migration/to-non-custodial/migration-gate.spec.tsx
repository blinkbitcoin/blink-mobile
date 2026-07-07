import React from "react"
import { render, act } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"

const mockUseActiveApiKeys = jest.fn()
const mockApiServiceScreen = jest.fn((_props: { onContinue: () => void }) => null)
const mockRequiredScreen = jest.fn(() => null)

jest.mock("@app/screens/account-migration/hooks", () => ({
  useActiveApiKeys: () => mockUseActiveApiKeys(),
}))

jest.mock("@app/screens/account-migration/to-non-custodial/api-service-screen", () => ({
  MigrationApiServiceScreen: (props: { onContinue: () => void }) =>
    mockApiServiceScreen(props),
}))

jest.mock(
  "@app/screens/account-migration/to-non-custodial/migration-required-screen",
  () => ({
    MigrationRequiredScreen: () => mockRequiredScreen(),
  }),
)

describe("MigrationGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
