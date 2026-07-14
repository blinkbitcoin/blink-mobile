import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationDownloadHistoryScreen } from "@app/screens/account-migration/to-non-custodial/download-history-screen"
import { ContextForScreen } from "../../helper"
import { walletOverviewQueryResult } from "../helpers"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockNavigateToCheckpoint = jest.fn()
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

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  ...jest.requireActual("@app/utils/toast"),
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationDownloadHistoryScreen />
    </ContextForScreen>,
  )

const pressDownload = () =>
  fireEvent.press(screen.getByText(LL.AccountMigration.downloadHistoryDownloadCta()))

const pressSecondary = () =>
  fireEvent.press(screen.getByTestId("migration-download-history-continue"))

const isContinueDisabled = () =>
  screen.getByTestId("migration-download-history-continue").props.accessibilityState
    ?.disabled

describe("MigrationDownloadHistoryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ btcBalance: 1, usdBalance: 1 }),
    )
    mockUseMigrationCheckpoint.mockReturnValue({
      navigateToCheckpoint: mockNavigateToCheckpoint,
      loading: false,
    })
    mockExportCsv.mockResolvedValue(true)
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
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
  })

  it("labels the secondary action Skip until the CSV is downloaded, then Continue", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LL.common.skip())).toBeTruthy()
    expect(screen.queryByText(LL.common.continue())).toBeNull()

    pressDownload()

    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())
    expect(screen.queryByText(LL.common.skip())).toBeNull()
  })

  it("downloads the CSV without leaving the screen", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockExportCsv).toHaveBeenCalledWith(["btc-1", "usd-1"]))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("reports the error with a visible toast and stays on screen when the export fails", async () => {
    mockExportCsv.mockRejectedValue(new Error("export failed"))
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockReportError).toHaveBeenCalled())
    expect(mockToastShow).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
  })

  it("keeps the secondary action on Skip when the user dismisses the share sheet", async () => {
    mockExportCsv.mockResolvedValue(false)
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockExportCsv).toHaveBeenCalled())
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
    expect(screen.queryByText(LL.common.continue())).toBeNull()
  })

  it("allows downloading multiple times before continuing", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()
    await flushEffects()
    pressDownload()
    await flushEffects()

    expect(mockExportCsv).toHaveBeenCalledTimes(2)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("disables Continue while a download is in progress", async () => {
    let resolveExport: () => void = () => {}
    mockExportCsv.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve
      }),
    )
    renderScreen()
    await flushEffects()

    pressDownload()
    expect(isContinueDisabled()).toBe(true)

    await act(async () => {
      resolveExport()
    })

    expect(isContinueDisabled()).toBe(false)
  })

  it("disables both actions while the migration checkpoint is loading", async () => {
    mockUseMigrationCheckpoint.mockReturnValue({
      navigateToCheckpoint: mockNavigateToCheckpoint,
      loading: true,
    })
    renderScreen()
    await flushEffects()

    expect(
      screen.getByTestId("migration-download-history-cta").props.accessibilityState
        ?.disabled,
    ).toBe(true)
    expect(isContinueDisabled()).toBe(true)
  })

  it("continues the migration flow when the secondary action is pressed", async () => {
    renderScreen()
    await flushEffects()

    pressSecondary()

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
  })
})
