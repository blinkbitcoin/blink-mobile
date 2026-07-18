import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { MigrationBalancesOverviewScreen } from "@app/screens/account-migration/to-non-custodial/balances-overview-screen"
import { ContextForScreen } from "../../helper"
import { walletOverviewQueryResult } from "../helpers"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const LLOverview = LL.AccountMigration.balancesOverview
const CONTACT_EMAIL = "support@blink.sv"

const mockNavigate = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockUseMigrationQuery = jest.fn()
const mockRefetchMigration = jest.fn()
const mockRefetchWallets = jest.fn()
let mockDollarRestricted = false
let mockCurrentDollarRestricted = false
let mockConvertReady = true
let mockGateArmed = false

let mockIsFocused = true

/** The server owns every figure on this screen, so each test states the preview it
 *  returns instead of deriving it from the wallet balance. */
const migrationQueryResult = (preview: {
  balanceSats: number
  feeSats: number
  feeCoveredByBlink: boolean
  receiveSats: number
}) => ({
  loading: false,
  data: {
    migration: {
      __typename: "AccountMigration" as const,
      preview: { __typename: "AccountMigrationPreview" as const, ...preview },
    },
  },
})

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => mockIsFocused,
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
  useMigrationQuery: () => mockUseMigrationQuery(),
}))

let mockIsAuthed = true

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

const mockSaveCheckpoint = jest.fn()
let mockCheckpointLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({
    loading: mockCheckpointLoading,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ supportEmailAddress: "support@blink.sv" }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: (accountType: string) =>
    accountType === "custodial" ? mockCurrentDollarRestricted : mockDollarRestricted,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
    }: {
      moneyAmount: { amount: number; currency: string }
    }) => `${moneyAmount.currency} ${moneyAmount.amount}`,
    moneyAmountToDisplayCurrencyString: ({
      isApproximate,
    }: {
      isApproximate?: boolean
    }) => (mockConvertReady ? `${isApproximate ? "~ " : ""}$FIAT` : undefined),
  }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationBalancesOverviewScreen />
    </ContextForScreen>,
  )

describe("MigrationBalancesOverviewScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveCheckpoint.mockResolvedValue(true)
    loadLocale("en")
    mockDollarRestricted = false
    mockCurrentDollarRestricted = false
    mockConvertReady = true
    mockCheckpointLoading = false
    mockGateArmed = false
    mockIsFocused = true
    mockIsAuthed = true
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 0 }),
    )
    mockUseMigrationQuery.mockReturnValue(
      migrationQueryResult({
        balanceSats: 1000,
        feeSats: 10,
        feeCoveredByBlink: false,
        receiveSats: 990,
      }),
    )
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve())
  })

  it("renders the hero, both balance cards, fee and actions without an exchange rate", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-send")).toBeTruthy()
    expect(screen.getByText(LLOverview.title())).toBeTruthy()
    expect(screen.getByText(LLOverview.body())).toBeTruthy()
    expect(screen.getByText(LLOverview.currentBitcoinBalance())).toBeTruthy()
    expect(screen.getByText(LLOverview.newBitcoinBalance())).toBeTruthy()
    /** Both figures come from the server preview verbatim, never client arithmetic. */
    expect(screen.getByText("BTC 1000 ($FIAT)")).toBeTruthy()
    expect(screen.getByText("BTC 990 ($FIAT)")).toBeTruthy()
    expect(screen.getByText(/Network fee:/)).toBeTruthy()
    expect(screen.queryByText(/covered by Blink/)).toBeNull()
    // The voluntary flow never quotes a rate; only the post-gate variant does.
    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
    expect(screen.getByText(LLOverview.approveCta())).toBeTruthy()
    expect(screen.getByText(LLOverview.contactSupportCta())).toBeTruthy()
  })

  it("marks the fee as covered by Blink for a de-minimis balance", async () => {
    mockUseMigrationQuery.mockReturnValue(
      migrationQueryResult({
        balanceSats: 80,
        feeSats: 10,
        feeCoveredByBlink: true,
        receiveSats: 80,
      }),
    )
    renderScreen()
    await flushEffects()

    // Blink covers the fee below the de-minimis threshold: the whole balance moves.
    expect(screen.getAllByText("BTC 80 ($FIAT)")).toHaveLength(2)
    expect(screen.getByText(/covered by Blink/)).toBeTruthy()
  })

  it("holds a spinner with Approve disabled while the server preview is in flight", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    /** Known balances are not enough: without the preview every bitcoin figure is
     *  unknown, and the commit screen must never present unknown amounts as zeros. */
    expect(screen.queryByText(LLOverview.currentBitcoinBalance())).toBeNull()
    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
    expect(screen.getByTestId("migration-balances-overview-approve")).toBeDisabled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("hands over to support when no migration applies to the account", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    renderScreen()
    await flushEffects()

    /** A settled answer with no preview never becomes one, so spinning here would
     *  strand the user at the commit point where the hardware back is swallowed. */
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  it("hands over to support when the server rejects the query", async () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("not eligible")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  /**
   * A skipped query reports neither loading nor error, the same shape as a server that
   * answered with nothing. Reading the two alike would hand a user whose session just
   * ended to migration support, and file a Crashlytics report blaming the backend.
   */
  it("keeps waiting instead of handing over when the session has ended", async () => {
    mockIsAuthed = false
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: false })
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
  })

  it("reports the migration preview as the missing source when the server has none", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration preview unavailable",
      expect.objectContaining({ message: "the commit screen has no migration preview" }),
    )
  })

  /** Blaming the migration query for a wallet-query failure points support and
   *  Crashlytics at the wrong subsystem. */
  it("reports the wallet balances as the missing source when they are what failed", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("forbidden")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration preview unavailable",
      expect.objectContaining({ message: "the commit screen has no wallet balances" }),
    )
  })

  it("reports both sources when neither one answered", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("forbidden")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration preview unavailable",
      expect.objectContaining({
        message: "the commit screen has no migration preview and wallet balances",
      }),
    )
  })

  it("offers a retry instead of support when the connection is what failed", async () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { networkError: new Error("Network request failed") },
    })
    renderScreen()
    await flushEffects()

    /** Connectivity comes back on its own, so support must never hear about it: the
     *  screen offers the retry and keeps the handover for answers that are final. */
    expect(screen.getByText(LL.errors.network.connection())).toBeTruthy()
    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
    expect(screen.queryByTestId("migration-balances-overview-approve")).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("refetches both queries when the retry is pressed", async () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { networkError: new Error("Network request failed") },
      refetch: mockRefetchMigration,
    })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 0 }),
      refetch: mockRefetchWallets,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-balances-overview-retry"))

    /** Refreshing only one would leave the other stale and drop straight back into a
     *  failed state. */
    expect(mockRefetchMigration).toHaveBeenCalled()
    expect(mockRefetchWallets).toHaveBeenCalled()
  })

  /** Apollo rejects a refetch that fails again, and the still-offline retry is the most
   *  likely press of all: unhandled, that rejection escapes a path the screen handles
   *  through the hooks' own error state. */
  it("swallows the rejection of a retry that fails again", async () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { networkError: new Error("Network request failed") },
      refetch: () => Promise.reject(new Error("Network request failed")),
    })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 0 }),
      refetch: () => Promise.reject(new Error("Network request failed")),
    })
    const onUnhandledRejection = jest.fn()
    process.on("unhandledRejection", onUnhandledRejection)
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-balances-overview-retry"))
    await flushEffects()
    process.off("unhandledRejection", onUnhandledRejection)

    expect(onUnhandledRejection).not.toHaveBeenCalled()
    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
  })

  it("shows the exchange rate only on the post-gate variant", async () => {
    mockGateArmed = true
    renderScreen()
    await flushEffects()

    expect(screen.getByText(/Current exchange rate/)).toBeTruthy()
  })

  it("commits to the transfer when Approve is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLOverview.approveCta()))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationTransferringFunds")
  })

  it("swallows the hardware back at the commit point", async () => {
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("persists the commit-point checkpoint on landing", async () => {
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.BalancesOverview)
  })

  it("keeps Approve disabled until the commit-point checkpoint is durably written", async () => {
    let resolveSave: (saved: boolean) => void = () => undefined
    mockSaveCheckpoint.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSave = resolve
      }),
    )
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-approve")).toBeDisabled()

    resolveSave(true)
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-approve")).not.toBeDisabled()
  })

  /**
   * A failed save must not silently brick this exit-sealed screen: it swaps the dead Approve
   * for a retry with an error message, the way the gate already surfaces a query failure.
   */
  it("surfaces a retry and an error when the checkpoint save fails", async () => {
    mockSaveCheckpoint.mockResolvedValue(false)
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
    expect(screen.getByText(LL.errors.generic())).toBeTruthy()
    expect(screen.queryByTestId("migration-balances-overview-approve")).toBeNull()
  })

  it("re-runs the save and enables Approve when the retry succeeds", async () => {
    mockSaveCheckpoint.mockResolvedValueOnce(false).mockResolvedValue(true)
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-balances-overview-retry"))
    await flushEffects()

    expect(mockSaveCheckpoint).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId("migration-balances-overview-retry")).toBeNull()
    expect(screen.getByTestId("migration-balances-overview-approve")).not.toBeDisabled()
  })

  /** The save can still be in flight when the screen unmounts (a background completion swaps
   *  the session under it), so a late resolution must be ignored, not set state on a dead
   *  screen. */
  it("ignores a checkpoint save that resolves after the screen unmounts", async () => {
    let resolveSave: (saved: boolean) => void = () => undefined
    mockSaveCheckpoint.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSave = resolve
      }),
    )
    const { unmount } = renderScreen()
    await flushEffects()
    expect(mockSaveCheckpoint).toHaveBeenCalledTimes(1)

    /** Resolving after unmount must be a no-op: the isActive guard drops it rather than
     *  setting state on the dead screen. Reaching the end without throwing is the proof. */
    unmount()
    expect(() => {
      resolveSave(true)
    }).not.toThrow()
    await flushEffects()
  })

  it("waits for the checkpoint to load before persisting the commit point", async () => {
    mockCheckpointLoading = true
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("does not re-save the checkpoint while the screen is unfocused", async () => {
    mockIsFocused = false
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  /** Recording the commit point without figures would make every later re-entry route
   *  back here and bounce straight to support, with the hardware back swallowed. */
  it("does not record the commit point when no migration applies to the account", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  it("does not record the commit point while the preview is still in flight", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("opens the support email when Contact support is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLOverview.contactSupportCta()))

    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`),
    )
  })

  it("shows a zero new dollar balance when self-custodial dollars are available", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LLOverview.dollarBalanceNotAvailable())).toBeNull()
    // Current and new dollar balances both read $0.00 via the mocked formatter.
    expect(screen.getAllByText("USD 0")).toHaveLength(2)
  })

  it("shows 'not available' for the new dollar balance when self-custodial dollars are restricted", async () => {
    mockDollarRestricted = true
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LLOverview.dollarBalanceNotAvailable())).toBeTruthy()
    // Only the current dollar balance keeps a value.
    expect(screen.getAllByText("USD 0")).toHaveLength(1)
  })

  it("shows 'not available' for the current dollar balance under the custodial restriction", async () => {
    mockCurrentDollarRestricted = true
    renderScreen()
    await flushEffects()

    /** Never zero, never blank: the restricted current row hides the amount while the
     *  unrestricted new row keeps its zero. */
    expect(screen.getByText(LLOverview.dollarBalanceNotAvailable())).toBeTruthy()
    expect(screen.getAllByText("USD 0")).toHaveLength(1)
  })

  it("shows 'not available' on both dollar rows in a fully restricted region", async () => {
    mockCurrentDollarRestricted = true
    mockDollarRestricted = true
    renderScreen()
    await flushEffects()

    expect(screen.getAllByText(LLOverview.dollarBalanceNotAvailable())).toHaveLength(2)
    expect(screen.queryByText("USD 0")).toBeNull()
  })

  it("hands over to support when wallet data settles without balances", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })
    renderScreen()
    await flushEffects()

    expect(screen.queryByText("Current Bitcoin Balance")).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  it("holds a spinner with Approve disabled while the wallet query loads", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
    expect(screen.getByTestId("migration-balances-overview-approve")).toBeDisabled()
  })

  it("hands over to support when the server rejects the wallet query", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      error: { graphQLErrors: [new Error("forbidden")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  it("offers a retry when the connection is what failed on the wallet query", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      error: { networkError: new Error("Network request failed") },
    })
    renderScreen()
    await flushEffects()

    /** Either source losing the network earns the same retry: the preview alone
     *  succeeding is not enough to render a screen whose dollar row needs the wallets. */
    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("hides the fiat suffix when price conversion is unavailable", async () => {
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.getByText("BTC 1000")).toBeTruthy()
    expect(screen.getByText("BTC 990")).toBeTruthy()
  })

  it("hides the exchange rate on the post-gate variant when conversion is unavailable", async () => {
    mockGateArmed = true
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
  })
})
