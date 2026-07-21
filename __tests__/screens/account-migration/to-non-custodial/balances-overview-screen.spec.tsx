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
const mockMigrationStart = jest.fn()
const mockRefetchMigration = jest.fn()
const mockRefetchWallets = jest.fn()

/** The server accepting the start is what arms the lock, so the default across the suite
 *  is an accepted start and each failure case states its own refusal. */
const acceptedMigrationStart = { data: { migrationStart: { errors: [] } } }
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
  useMigrationStartMutation: () => [mockMigrationStart],
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

let mockCheckpointAccountId: string | null = "sc-account-1"
let mockOwnerId: string | null = "owner-1"
const mockLnRetry = jest.fn()
let mockLnAddressTransfer = {
  isTransferred: true,
  isRejected: false,
  hasConnectionIssue: false,
  retry: mockLnRetry,
}

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({
    accountId: mockCheckpointAccountId,
    loading: mockCheckpointLoading,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

const mockUseLnAddressTransfer = jest.fn()
jest.mock(
  "@app/screens/account-migration/hooks/use-migration-ln-address-transfer",
  () => ({
    useMigrationLnAddressTransfer: (args: unknown) => {
      mockUseLnAddressTransfer(args)
      return mockLnAddressTransfer
    },
  }),
)

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
    loadLocale("en")
    mockDollarRestricted = false
    mockCurrentDollarRestricted = false
    mockConvertReady = true
    mockCheckpointLoading = false
    mockCheckpointAccountId = "sc-account-1"
    mockOwnerId = "owner-1"
    mockLnAddressTransfer = {
      isTransferred: true,
      isRejected: false,
      hasConnectionIssue: false,
      retry: mockLnRetry,
    }
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
    mockMigrationStart.mockResolvedValue(acceptedMigrationStart)
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
    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )
  })

  it("hands over to support when the server rejects the query", async () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("Unexpected server error")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )
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

  /** One code serves the Crashlytics report and the ticket the user carries, so support
   *  can correlate the two. */
  it("reports the same code the user's ticket will carry", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration handed over to support",
      expect.objectContaining({ message: "preview-unavailable" }),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "preview-unavailable",
    })
  })

  /** Blaming the migration query for a wallet-query failure points support and
   *  Crashlytics at the wrong subsystem. */
  it("blames the wallet balances when they are what failed", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("forbidden")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration handed over to support",
      expect.objectContaining({ message: "balances-unavailable" }),
    )
  })

  /** Landing with figures is what declares the migration started server-side; that is
   *  the whole point of no return, and it must not fire before the figures exist. */
  it("declares the migration started once the figures are on screen", async () => {
    renderScreen()
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("migration-balances-overview-approve")).toBeEnabled()
  })

  it("does not declare a migration started while the preview is in flight", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(mockMigrationStart).not.toHaveBeenCalled()
  })

  /** Approve commits against a server-side flow, so a screen that has figures but no
   *  accepted start must not let the user commit into a flow that does not exist. */
  it("keeps Approve off until the server accepts the start", async () => {
    /** Never settles, so the screen is observed exactly while the start is in flight. */
    mockMigrationStart.mockReturnValue(
      new Promise(() => {
        /* left pending on purpose */
      }),
    )
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-approve")).toBeDisabled()
  })

  it("hands over to support when the server refuses to start the migration", async () => {
    mockMigrationStart.mockResolvedValue({
      data: {
        migrationStart: {
          errors: [
            {
              message: "Dollar balance must be empty before migration",
              code: "MIGRATION_STATE_CONFLICT",
            },
          ],
        },
      },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )

    /** Blaming the preview for a refused start would point support at a query that
     *  answered perfectly well. */
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration handed over to support",
      expect.objectContaining({ message: "start-refused" }),
    )
  })

  /** The figures loading is not enough: without a started migration there is nothing to
   *  commit to, so a start the network dropped earns the same retry. */
  /** The two failures on this screen are different tickets, so support must not have to
   *  guess which one it is looking at. */
  it("tells support the server refused the start", async () => {
    mockMigrationStart.mockResolvedValue({
      data: {
        migrationStart: {
          errors: [
            {
              message: "Dollar balance must be empty before migration",
              code: "MIGRATION_STATE_CONFLICT",
            },
          ],
        },
      },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "start-refused",
    })
  })

  it("tells support the preview never arrived", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "preview-unavailable",
    })
  })

  it("offers a retry when the connection is what stopped the start", async () => {
    const offline = Object.assign(new Error("Network request failed"), {
      networkError: new Error("offline"),
    })
    mockMigrationStart.mockRejectedValue(offline)
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The start can fail over a preview that loaded fine, so the balances are on screen
   *  and a bare retry underneath them would carry no reason at all. */
  it("explains the retry even when the figures loaded", async () => {
    const offline = Object.assign(new Error("Network request failed"), {
      networkError: new Error("offline"),
    })
    mockMigrationStart.mockRejectedValue(offline)
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LLOverview.currentBitcoinBalance())).toBeTruthy()
    expect(screen.getByText(LL.errors.network.connection())).toBeTruthy()
    expect(screen.getByTestId("migration-balances-overview-retry")).toBeTruthy()
  })

  /** One failure is one event however many times the user bounces off this screen. */
  it("reports the handover once even as the screen re-renders", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    const { rerender } = renderScreen()
    await flushEffects()
    rerender(
      <ContextForScreen>
        <MigrationBalancesOverviewScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("retries the start alongside the queries", async () => {
    const offline = Object.assign(new Error("Network request failed"), {
      networkError: new Error("offline"),
    })
    mockMigrationStart.mockRejectedValueOnce(offline)
    mockUseMigrationQuery.mockReturnValue({
      ...migrationQueryResult({
        balanceSats: 1000,
        feeSats: 10,
        feeCoveredByBlink: false,
        receiveSats: 990,
      }),
      refetch: mockRefetchMigration,
    })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 0 }),
      refetch: mockRefetchWallets,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-balances-overview-retry"))
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(2)
    expect(mockRefetchMigration).toHaveBeenCalled()
  })

  /** The preview answers for the case where neither source did: every figure on the
   *  screen comes from it, so it is the more useful of the two to chase first. */
  it("blames the preview when neither source answered", async () => {
    mockUseMigrationQuery.mockReturnValue({ data: { migration: null }, loading: false })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("forbidden")] },
    })
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "preview-unavailable",
    })
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
    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )
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
    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )
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

    expect(mockNavigate).toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.objectContaining({ reason: expect.any(String) }),
    )
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

  /** The re-point is a precondition of the commit, so a settled failure hands over exactly
   *  like a refused start. */
  it("hands over to support when the lightning-address re-point fails", async () => {
    mockLnAddressTransfer = {
      isTransferred: false,
      isRejected: true,
      hasConnectionIssue: false,
      retry: mockLnRetry,
    }
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "ln-address-transfer-failed",
    })
  })

  /** In-flight is not a failure: Approve stays off, but the user is NOT sent to support. */
  it("keeps Approve off until the lightning address has moved, without a handover", async () => {
    mockLnAddressTransfer = {
      isTransferred: false,
      isRejected: false,
      hasConnectionIssue: false,
      retry: mockLnRetry,
    }
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-approve")).toBeDisabled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The re-point signs its proof against the real Galoy owner id, not the registry's
   *  shared placeholder, so the challenge names the account the backend verifies against. */
  it("drives the re-point with the custodial owner id and the provisioned account", async () => {
    renderScreen()
    await flushEffects()

    expect(mockUseLnAddressTransfer).toHaveBeenCalledWith({
      custodialAccountId: "owner-1",
      selfCustodialAccountId: "sc-account-1",
      skip: false,
    })
  })

  it("retries the re-point along with the rest when it loses the network", async () => {
    mockLnAddressTransfer = {
      isTransferred: false,
      isRejected: false,
      hasConnectionIssue: true,
      retry: mockLnRetry,
    }
    mockUseMigrationQuery.mockReturnValue({
      ...migrationQueryResult({
        balanceSats: 1000,
        feeSats: 10,
        feeCoveredByBlink: false,
        receiveSats: 990,
      }),
      refetch: mockRefetchMigration,
    })
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      ...walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 0 }),
      refetch: mockRefetchWallets,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-balances-overview-retry"))

    expect(mockLnRetry).toHaveBeenCalledTimes(1)
  })
})
