import React from "react"
import { act, render } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockSettingsRow = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: mockSettingsRow,
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: { apiAcess: () => "API integration" },
    },
  }),
}))

import { ApiAccessSetting } from "@app/screens/settings-screen/settings/advanced-api-access"

const lastRowProps = (): Record<string, unknown> =>
  (mockSettingsRow.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

describe("ApiAccessSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("navigates to the API screen when tapped on a custodial account", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "c-1", type: AccountType.Custodial },
    })

    render(<ApiAccessSetting />)

    expect(lastRowProps().title).toBe("API integration")
    act(() => (lastRowProps().action as () => void)())
    expect(mockNavigate).toHaveBeenCalledWith("apiScreen")
  })

  it("renders nothing for a self-custodial account", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })

    const { toJSON } = render(<ApiAccessSetting />)

    expect(toJSON()).toBeNull()
    expect(mockSettingsRow).not.toHaveBeenCalled()
  })
})
