import { renderHook } from "@testing-library/react-native"

import { useHasTransactions } from "@app/screens/account-migration/hooks/use-has-transactions"

const mockUseMigrationTransactionsPresenceQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationTransactionsPresenceQuery: () =>
    mockUseMigrationTransactionsPresenceQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const presence = (edges: { cursor: string }[]) => ({
  loading: false,
  data: { me: { defaultAccount: { transactions: { edges } } } },
})

describe("useHasTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reports history when the account has at least one transaction", () => {
    mockUseMigrationTransactionsPresenceQuery.mockReturnValue(
      presence([{ cursor: "tx-1" }]),
    )

    const { result } = renderHook(() => useHasTransactions())

    expect(result.current).toEqual({ hasTransactions: true, loading: false })
  })

  it("reports no history for an account without transactions", () => {
    mockUseMigrationTransactionsPresenceQuery.mockReturnValue(presence([]))

    const { result } = renderHook(() => useHasTransactions())

    expect(result.current).toEqual({ hasTransactions: false, loading: false })
  })

  it("reports no history while the data is unavailable", () => {
    mockUseMigrationTransactionsPresenceQuery.mockReturnValue({
      loading: true,
      data: undefined,
    })

    const { result } = renderHook(() => useHasTransactions())

    expect(result.current).toEqual({ hasTransactions: false, loading: true })
  })
})
