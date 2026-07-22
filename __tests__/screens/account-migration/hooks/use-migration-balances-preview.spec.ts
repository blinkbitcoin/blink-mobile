import { renderHook } from "@testing-library/react-native"

import { useMigrationBalancesPreview } from "@app/screens/account-migration/hooks/use-migration-balances-preview"

let mockBalances = { btcBalanceSats: 1000, usdBalanceCents: 500, isReady: true }
let mockPreview = {
  balanceSats: 1000,
  receiveSats: 990,
  feeSats: 10,
  feeCoveredByBlink: false,
}
let mockGateArmed = false
let mockCurrentDollarRestricted = false
let mockNewDollarRestricted = false
let mockFiatReady = true

jest.mock("@app/screens/account-migration/hooks/use-custodial-wallet-balances", () => ({
  useCustodialWalletBalances: () => mockBalances,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-preview", () => ({
  useMigrationPreview: () => mockPreview,
}))

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: (accountType: string) =>
    accountType === "custodial" ? mockCurrentDollarRestricted : mockNewDollarRestricted,
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
    }) => (mockFiatReady ? `${isApproximate ? "~" : ""}$FIAT` : undefined),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountMigration: {
        balancesOverview: {
          dollarBalanceNotAvailable: () => "Not available",
          networkFee: ({ fee }: { fee: string }) => `Network fee: ${fee}`,
          networkFeeCoveredByBlink: ({ fee }: { fee: string }) =>
            `Network fee: ${fee}, covered by Blink`,
        },
      },
    },
  }),
}))

describe("useMigrationBalancesPreview", () => {
  beforeEach(() => {
    mockBalances = { btcBalanceSats: 1000, usdBalanceCents: 500, isReady: true }
    mockPreview = {
      balanceSats: 1000,
      receiveSats: 990,
      feeSats: 10,
      feeCoveredByBlink: false,
    }
    mockGateArmed = false
    mockCurrentDollarRestricted = false
    mockNewDollarRestricted = false
    mockFiatReady = true
  })

  it("passes readiness through from the balances hook", () => {
    mockBalances = { ...mockBalances, isReady: false }

    const { result } = renderHook(() => useMigrationBalancesPreview())

    expect(result.current.isReady).toBe(false)
  })

  it("renders the current and new bitcoin balances from the server preview verbatim", () => {
    const { result } = renderHook(() => useMigrationBalancesPreview())

    expect(result.current.currentBitcoinBalance).toBe("BTC 1000")
    expect(result.current.newBitcoinBalance).toBe("BTC 990")
    expect(result.current.currentBitcoinFiat).toBe(" ($FIAT)")
  })

  it("omits the fiat suffix when price conversion is unavailable", () => {
    mockFiatReady = false

    const { result } = renderHook(() => useMigrationBalancesPreview())

    expect(result.current.currentBitcoinFiat).toBeUndefined()
  })

  it("shows the custodial dollar balance, or 'not available' when it is restricted", () => {
    const { result: unrestricted } = renderHook(() => useMigrationBalancesPreview())
    expect(unrestricted.current.currentDollarBalance).toBe("USD 500")
    expect(unrestricted.current.isCurrentDollarBalanceRestricted).toBe(false)

    mockCurrentDollarRestricted = true
    const { result: restricted } = renderHook(() => useMigrationBalancesPreview())
    expect(restricted.current.currentDollarBalance).toBe("Not available")
    expect(restricted.current.isCurrentDollarBalanceRestricted).toBe(true)
  })

  it("shows a zero new dollar balance, or 'not available' when self-custodial dollars are restricted", () => {
    const { result: unrestricted } = renderHook(() => useMigrationBalancesPreview())
    expect(unrestricted.current.newDollarBalance).toBe("USD 0")

    mockNewDollarRestricted = true
    const { result: restricted } = renderHook(() => useMigrationBalancesPreview())
    expect(restricted.current.newDollarBalance).toBe("Not available")
  })

  it("marks the network fee as covered by Blink when the preview subsidises it", () => {
    const { result: normal } = renderHook(() => useMigrationBalancesPreview())
    expect(normal.current.networkFeeLine).not.toContain("covered by Blink")

    mockPreview = { ...mockPreview, feeCoveredByBlink: true }
    const { result: covered } = renderHook(() => useMigrationBalancesPreview())
    expect(covered.current.networkFeeLine).toContain("covered by Blink")
  })

  it("quotes an exchange rate only on the post-gate variant", () => {
    const { result: preGate } = renderHook(() => useMigrationBalancesPreview())
    expect(preGate.current.exchangeRate).toBeUndefined()

    mockGateArmed = true
    const { result: postGate } = renderHook(() => useMigrationBalancesPreview())
    expect(postGate.current.exchangeRate).toBeDefined()
  })
})
