import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationDownloadHistoryScreen } from "@app/screens/account-migration/to-non-custodial/download-history-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const NEXT_ROUTE = "accountMigrationExplainer"

const mockNavigate = jest.fn()
const mockExportCsv = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockUseMigrationCheckpoint = jest.fn()
const mockReportError = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => mockUseMigrationCheckpoint(),
}))

jest.mock("@app/hooks/use-export-transactions-csv", () => ({
  useExportTransactionsCsv: () => ({ exportCsv: mockExportCsv, loading: false }),
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const walletsData = {
  data: {
    me: {
      defaultAccount: {
        wallets: [
          { __typename: "BTCWallet", id: "btc-1", walletCurrency: "BTC", balance: 1 },
          { __typename: "USDWallet", id: "usd-1", walletCurrency: "USD", balance: 1 },
        ],
      },
    },
  },
}

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationDownloadHistoryScreen />
    </ContextForScreen>,
  )

const pressDownload = () =>
  fireEvent.press(screen.getByText(LL.AccountMigration.downloadHistoryDownloadCta()))

describe("MigrationDownloadHistoryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsData)
    mockUseMigrationCheckpoint.mockReturnValue({
      getRouteForCheckpoint: () => NEXT_ROUTE,
      loading: false,
    })
    mockExportCsv.mockResolvedValue(undefined)
  })

  it("renders the clock hero, title, body and both actions", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-clock")).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.downloadHistoryTitle())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.downloadHistoryBody())).toBeTruthy()
    expect(
      screen.getByText(LL.AccountMigration.downloadHistoryDownloadCta()),
    ).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.downloadHistorySkipCta())).toBeTruthy()
  })

  it("exports the account wallets as a CSV and continues when it finishes", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(NEXT_ROUTE))
    expect(mockExportCsv).toHaveBeenCalledWith(["btc-1", "usd-1"])
  })

  it("reports the error and stays on screen when the export fails", async () => {
    mockExportCsv.mockRejectedValue(new Error("export failed"))
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockReportError).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("blocks navigation and disables Skip while the export is in progress", async () => {
    let resolveExport: () => void = () => {}
    mockExportCsv.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve
      }),
    )
    renderScreen()
    await flushEffects()

    pressDownload()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(
      screen.getByTestId("migration-download-history-skip").props.accessibilityState
        ?.disabled,
    ).toBe(true)

    resolveExport()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(NEXT_ROUTE))
  })

  it("disables both actions while the migration checkpoint is loading", async () => {
    mockUseMigrationCheckpoint.mockReturnValue({
      getRouteForCheckpoint: () => NEXT_ROUTE,
      loading: true,
    })
    renderScreen()
    await flushEffects()

    expect(
      screen.getByTestId("migration-download-history-cta").props.accessibilityState
        ?.disabled,
    ).toBe(true)
    expect(
      screen.getByTestId("migration-download-history-skip").props.accessibilityState
        ?.disabled,
    ).toBe(true)
  })

  it("continues the migration flow when Skip is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.downloadHistorySkipCta()))

    expect(mockNavigate).toHaveBeenCalledWith(NEXT_ROUTE)
  })
})
