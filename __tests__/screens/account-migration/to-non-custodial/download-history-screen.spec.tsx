import React from "react"
import { Platform } from "react-native"
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

const screenTree = () => (
  <ContextForScreen>
    <MigrationDownloadHistoryScreen />
  </ContextForScreen>
)

const renderScreen = () => render(screenTree())

const DEFAULT_PLATFORM_OS = Platform.OS

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
  afterEach(() => {
    Platform.OS = DEFAULT_PLATFORM_OS
  })

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

  it("offers no second download on iOS, whose share sheet reports the activity's own completion", async () => {
    Platform.OS = "ios"
    renderScreen()
    await flushEffects()

    pressDownload()
    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())

    expect(screen.queryByTestId("migration-download-history-redownload")).toBeNull()
  })

  /** Android's chooser resolves success once a target app is picked, so a Drive or Gmail
   *  save the user then cancels still lands here; Download has to stay reachable. */
  it("keeps Download available on Android after the chooser reports success", async () => {
    Platform.OS = "android"
    renderScreen()
    await flushEffects()

    pressDownload()
    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())
    expect(screen.queryByText(LL.common.skip())).toBeNull()

    fireEvent.press(screen.getByTestId("migration-download-history-redownload"))
    await waitFor(() => expect(mockExportCsv).toHaveBeenCalledTimes(2))
    expect(mockContinuePastHistory).not.toHaveBeenCalled()

    pressPrimary()
    expect(mockContinuePastHistory).toHaveBeenCalledTimes(1)
  })

  it("keeps Continue enabled when the wallet balances refetch after a download", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()
    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())

    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    })
    screen.rerender(screenTree())
    await flushEffects()

    expect(isPrimaryDisabled()).toBe(false)
  })

  it("disables Continue while the next step is still being resolved after a download", async () => {
    renderScreen()
    await flushEffects()

    pressDownload()
    await waitFor(() => expect(screen.getByText(LL.common.continue())).toBeTruthy())

    mockUseMigrationNextStep.mockReturnValue({
      continuePastHistory: mockContinuePastHistory,
      loading: true,
    })
    screen.rerender(screenTree())
    await flushEffects()

    expect(isPrimaryDisabled()).toBe(true)
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

  it("allows retrying the download after a dismissed share sheet", async () => {
    mockExportCsv.mockResolvedValue(false)
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
      new Promise<void>((resolve) => {
        resolveExport = resolve
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
