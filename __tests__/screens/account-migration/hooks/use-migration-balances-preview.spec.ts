import { renderHook } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useMigrationBalancesPreview } from "@app/screens/account-migration/hooks/use-migration-balances-preview"
import { AccountMigrationPreview } from "@app/types/migration"

loadLocale("en")
const mockLL = i18nObject("en")

const mockUseMigrationPreview = jest.fn()
const mockUseCustodialWalletBalances = jest.fn()

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-preview", () => ({
  useMigrationPreview: () => mockUseMigrationPreview(),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-wallet-balances", () => ({
  useCustodialWalletBalances: (options: unknown) =>
    mockUseCustodialWalletBalances(options),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    accountMode: null,
    isAnonMode: false,
    getModeFor: () => null,
    setAccountMode: jest.fn(),
    setActiveAccountMode: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => false,
  useDollarBalanceRestriction: () => ({ isRestricted: false, isRegionPending: false }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} sats`,
    moneyAmountToDisplayCurrencyString: () => "$1.00",
  }),
}))

const previewOf = (receiveSats: number): AccountMigrationPreview => ({
  balanceSats: receiveSats + 10,
  feeSats: 10,
  feeCoveredByBlink: false,
  receiveSats,
})

const previewSource = (preview: AccountMigrationPreview | null) => ({
  preview,
  loading: false,
  isSkipped: false,
  hasConnectionIssue: false,
  refetch: jest.fn(),
})

const balancesSource = (isReady: boolean) => ({
  usdBalanceCents: 0,
  isReady,
  loading: !isReady,
  isSkipped: false,
  hasConnectionIssue: false,
  refetch: jest.fn(),
})

describe("useMigrationBalancesPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMigrationPreview.mockReturnValue(previewSource(previewOf(990)))
    mockUseCustodialWalletBalances.mockReturnValue(balancesSource(true))
  })

  it("reports the server's raw receive figure once both sources are ready", () => {
    const { result } = renderHook(() =>
      useMigrationBalancesPreview({
        provisionedAccountId: "sc-account-1",
        isProvisionedAccountLoading: false,
      }),
    )

    expect(result.current.isReady).toBe(true)
    expect(result.current.expectedReceiveSats).toBe(990)
  })

  /** The receive gate reads a zero as "nothing will ever arrive" and opens without waiting,
   *  so the placeholder preview's own zero must never reach a caller as a figure. */
  it("reports no expectation while the server has not answered with a preview", () => {
    mockUseMigrationPreview.mockReturnValue(previewSource(null))

    const { result } = renderHook(() =>
      useMigrationBalancesPreview({
        provisionedAccountId: "sc-account-1",
        isProvisionedAccountLoading: false,
      }),
    )

    expect(result.current.isReady).toBe(false)
    expect(result.current.expectedReceiveSats).toBeNull()
  })

  it("reports no expectation while the custodial balances are still loading", () => {
    mockUseCustodialWalletBalances.mockReturnValue(balancesSource(false))

    const { result } = renderHook(() =>
      useMigrationBalancesPreview({
        provisionedAccountId: "sc-account-1",
        isProvisionedAccountLoading: false,
      }),
    )

    expect(result.current.isReady).toBe(false)
    expect(result.current.expectedReceiveSats).toBeNull()
  })

  /** A zero the server actually answered is a real zero-receive migration, not the unknown
   *  the placeholder stands for, and the two must stay distinguishable. */
  it("reports a server-answered zero as a figure, not as unknown", () => {
    mockUseMigrationPreview.mockReturnValue(previewSource(previewOf(0)))

    const { result } = renderHook(() =>
      useMigrationBalancesPreview({
        provisionedAccountId: "sc-account-1",
        isProvisionedAccountLoading: false,
      }),
    )

    expect(result.current.isReady).toBe(true)
    expect(result.current.expectedReceiveSats).toBe(0)
  })
})
