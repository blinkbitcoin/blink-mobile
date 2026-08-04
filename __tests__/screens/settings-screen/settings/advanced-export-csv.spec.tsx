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

const mockCustodialExportCsv = jest.fn()
jest.mock("@app/hooks/use-export-transactions-csv", () => ({
  useExportTransactionsCsv: () => ({
    exportCsv: mockCustodialExportCsv,
    loading: false,
  }),
}))

const mockSelfCustodialExportCsv = jest.fn()
jest.mock("@app/self-custodial/hooks/use-export-transactions-csv", () => ({
  useExportSelfCustodialTransactionsCsv: () => ({
    exportCsv: mockSelfCustodialExportCsv,
    loading: false,
  }),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: () => ({
    data: {
      me: {
        defaultAccount: {
          wallets: [
            { id: "btc-1", walletCurrency: "BTC" },
            { id: "usd-1", walletCurrency: "USD" },
          ],
        },
      },
    },
    loading: false,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { csvExport: () => "Export all transactions" },
      SettingsScreen: { csvTransactionsError: () => "Export failed" },
    },
  }),
}))

import { ExportCsvSetting } from "@app/screens/settings-screen/settings/advanced-export-csv"

const lastRowProps = (): Record<string, unknown> =>
  (mockSettingsRow.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

const pressRow = async () => {
  await act(async () => {
    await (lastRowProps().action as () => Promise<void>)()
  })
}

describe("ExportCsvSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCustodialExportCsv.mockResolvedValue(true)
    mockSelfCustodialExportCsv.mockResolvedValue(true)
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: {} })
  })

  it("exports through the custodial hook with the account wallet ids", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "c-1", type: AccountType.Custodial },
    })

    render(<ExportCsvSetting />)
    await pressRow()

    expect(lastRowProps().title).toBe("Export all transactions")
    expect(mockCustodialExportCsv).toHaveBeenCalledWith(["btc-1", "usd-1"])
    expect(mockSelfCustodialExportCsv).not.toHaveBeenCalled()
  })

  it("exports through the self-custodial hook for a self-custodial account", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })

    render(<ExportCsvSetting />)
    await pressRow()

    expect(lastRowProps().title).toBe("Export all transactions")
    expect(mockSelfCustodialExportCsv).toHaveBeenCalledTimes(1)
    expect(mockCustodialExportCsv).not.toHaveBeenCalled()
  })

  it("marks the self-custodial row as loading until the SDK is connected", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    render(<ExportCsvSetting />)

    expect(lastRowProps().loading).toBe(true)
  })

  it("reports the error and toasts when the self-custodial export fails", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })
    mockSelfCustodialExportCsv.mockRejectedValue(new Error("boom"))

    render(<ExportCsvSetting />)
    await pressRow()

    expect(mockReportError).toHaveBeenCalledWith(
      "self-custodial-export-csv",
      expect.any(Error),
    )
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Export failed" }),
    )
  })
})
