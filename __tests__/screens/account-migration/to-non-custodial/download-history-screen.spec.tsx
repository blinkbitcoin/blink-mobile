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
const mockContinuePastHistory = jest.fn()
const mockExportCsv = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockUseMigrationNextStep = jest.fn()
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
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationNextStep: () => mockUseMigrationNextStep(),
}))

jest.mock("@app/custodial/hooks/use-export-transactions-csv", () => ({
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

const pressPrimary = () =>
  fireEvent.press(screen.getByTestId("migration-download-history-cta"))

const pressSkip = () =>
  fireEvent.press(screen.getByTestId("migration-download-history-continue"))

const isPrimaryDisabled = () =>
  screen.getByTestId("migration-download-history-cta").props.accessibilityState?.disabled

const isSkipDisabled = () =>
  screen.getByTestId("migration-download-history-continue").props.accessibilityState
    ?.disabled

describe("MigrationDownloadHistoryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ btcBalance: 1, usdBalance: 1 }),
    )
    mockUseMigrationNextStep.mockReturnValue({
      continuePastHistory: mockContinuePastHistory,
      loading: false,
    })
    mockExportCsv.mockResolvedValue("shared")
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

  it("swaps Download + Skip for a single Continue once the CSV is downloaded", async () => {
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText(LL.AccountMigration.downloadHistoryDownloadCta()),
    ).toBeTruthy()
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
    expect(screen.queryByText(LL.common.continue())).toBeNull()

    pressDownload()

    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())
    expect(screen.queryByText(LL.common.skip())).toBeNull()
    expect(
      screen.queryByText(LL.AccountMigration.downloadHistoryDownloadCta()),
    ).toBeNull()
  })

  it("continues the migration flow when the primary CTA is pressed after a download", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()
    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())

    pressPrimary()

    expect(mockContinuePastHistory).toHaveBeenCalledTimes(1)
    expect(mockExportCsv).toHaveBeenCalledTimes(1)
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
    mockExportCsv.mockResolvedValue("cancelled")
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockExportCsv).toHaveBeenCalled())
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
    expect(screen.queryByText(LL.common.continue())).toBeNull()
  })

  it("allows retrying the download after a dismissed share sheet", async () => {
    mockExportCsv.mockResolvedValue("cancelled")
    renderScreen()
    await flushEffects()

    pressDownload()
    await flushEffects()
    pressDownload()
    await flushEffects()

    expect(mockExportCsv).toHaveBeenCalledTimes(2)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("disables Skip while a download is in progress", async () => {
    let resolveExport: () => void = () => {}
    mockExportCsv.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveExport = () => resolve("cancelled")
      }),
    )
    renderScreen()
    await flushEffects()

    pressDownload()
    expect(isSkipDisabled()).toBe(true)

    await act(async () => {
      resolveExport()
    })

    expect(isSkipDisabled()).toBe(false)
  })

  it("disables Download but keeps Skip available while the wallet balances load", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    })
    renderScreen()
    await flushEffects()

    expect(isPrimaryDisabled()).toBe(true)
    expect(isSkipDisabled()).toBe(false)
  })

  it("keeps Download disabled but Skip available when the wallet query errors", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("wallets failed"),
      refetch: jest.fn(),
    })
    renderScreen()
    await flushEffects()

    expect(isPrimaryDisabled()).toBe(true)
    expect(isSkipDisabled()).toBe(false)
  })

  it("disables both actions while the next step is still being resolved", async () => {
    mockUseMigrationNextStep.mockReturnValue({
      continuePastHistory: mockContinuePastHistory,
      loading: true,
    })
    renderScreen()
    await flushEffects()

    expect(isPrimaryDisabled()).toBe(true)
    expect(isSkipDisabled()).toBe(true)
  })

  it("confirms with a toast when the CSV downloads straight to a file", async () => {
    mockExportCsv.mockResolvedValue("saved")
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: LL.SettingsScreen.csvTransactionsSaved(),
        type: "success",
      }),
    )
  })

  it("stays quiet and swaps the CTA when the export goes to the share sheet", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("keeps Download and Skip when there is nothing to export", async () => {
    mockExportCsv.mockResolvedValue("empty")
    renderScreen()
    await flushEffects()

    pressDownload()

    await waitFor(() => expect(mockExportCsv).toHaveBeenCalled())
    expect(screen.getByText(LL.common.skip())).toBeTruthy()
    expect(screen.queryByText(LL.common.continue())).toBeNull()
  })

  /** Through the same routing as every other step, not the stored checkpoint directly: a
   *  commit point the server has since closed must restart from here, not land back on
   *  the commit screen. Where that routing goes is pinned in the next-step hook's spec. */
  it("continues through the flow's routing when Skip is pressed", async () => {
    renderScreen()
    await flushEffects()

    pressSkip()

    expect(mockContinuePastHistory).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
