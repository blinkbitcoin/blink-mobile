import { renderHook, act } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

const mockUseIsAuthed = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseDisplayCurrencyQuery = jest.fn()
const mockUpdateDisplayCurrencyMutation = jest.fn()
const mockUseAccountUpdateDisplayCurrencyMutation = jest.fn(
  (): [typeof mockUpdateDisplayCurrencyMutation, { loading: boolean }] => [
    mockUpdateDisplayCurrencyMutation,
    { loading: false },
  ],
)
const mockUpdateState = jest.fn()
let mockPersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: undefined as string | undefined,
  selfCustodialDisplayCurrencyByAccountId: undefined as
    | Record<string, string>
    | undefined,
}

jest.mock("@app/graphql/generated", () => ({
  useDisplayCurrencyQuery: (...args: unknown[]) => mockUseDisplayCurrencyQuery(...args),
  useAccountUpdateDisplayCurrencyMutation: () =>
    mockUseAccountUpdateDisplayCurrencyMutation(),
  RealtimePriceDocument: { kind: "Document" },
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import { useEffectiveDisplayCurrency } from "@app/hooks/use-effective-display-currency"

describe("useEffectiveDisplayCurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = {
      schemaVersion: 11,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: undefined,
      selfCustodialDisplayCurrencyByAccountId: undefined,
    }
    mockUseDisplayCurrencyQuery.mockReturnValue({
      data: undefined,
      loading: false,
    })
  })

  describe("custodial path", () => {
    beforeEach(() => {
      mockUseIsAuthed.mockReturnValue(true)
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { type: AccountType.Custodial },
      })
    })

    it("reads displayCurrency from the GraphQL query", () => {
      mockUseDisplayCurrencyQuery.mockReturnValue({
        data: { me: { defaultAccount: { displayCurrency: "EUR" } } },
        loading: false,
      })

      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      expect(result.current.displayCurrency).toBe("EUR")
    })

    it("falls back to USD when query data is missing", () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      expect(result.current.displayCurrency).toBe("USD")
    })

    it("does not skip the query when authed and custodial", () => {
      renderHook(() => useEffectiveDisplayCurrency())

      expect(mockUseDisplayCurrencyQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      )
    })

    it("setDisplayCurrency runs the mutation with RealtimePrice refetch", async () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      await act(async () => {
        await result.current.setDisplayCurrency("GBP")
      })

      expect(mockUpdateDisplayCurrencyMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { currency: "GBP" } },
          refetchQueries: expect.any(Array),
        }),
      )
    })

    it("setDisplayCurrency does not write to persistent state", async () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      await act(async () => {
        await result.current.setDisplayCurrency("GBP")
      })

      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial path", () => {
    beforeEach(() => {
      mockUseIsAuthed.mockReturnValue(false)
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      })
      mockPersistentState = {
        ...mockPersistentState,
        activeAccountId: "sc-1",
      }
    })

    it("reads displayCurrency from the per-account persistent map", () => {
      mockPersistentState.selfCustodialDisplayCurrencyByAccountId = { "sc-1": "JPY" }

      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      expect(result.current.displayCurrency).toBe("JPY")
    })

    it("falls back to USD when no per-account value is set", () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      expect(result.current.displayCurrency).toBe("USD")
    })

    it("skips the GraphQL query in self-custodial mode", () => {
      renderHook(() => useEffectiveDisplayCurrency())

      expect(mockUseDisplayCurrencyQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("setDisplayCurrency writes to persistent state under the active id", async () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      await act(async () => {
        await result.current.setDisplayCurrency("JPY")
      })

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater(mockPersistentState)
      expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({ "sc-1": "JPY" })
    })

    it("setDisplayCurrency does not call the GraphQL mutation", async () => {
      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      await act(async () => {
        await result.current.setDisplayCurrency("JPY")
      })

      expect(mockUpdateDisplayCurrencyMutation).not.toHaveBeenCalled()
    })

    it("loading is false even while custodial query reports loading", () => {
      mockUseDisplayCurrencyQuery.mockReturnValue({ data: undefined, loading: true })

      const { result } = renderHook(() => useEffectiveDisplayCurrency())

      expect(result.current.loading).toBe(false)
    })
  })

  it("isolates per-account currency when switching active SC accounts", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })
    mockPersistentState = {
      ...mockPersistentState,
      activeAccountId: "sc-1",
      selfCustodialDisplayCurrencyByAccountId: { "sc-1": "EUR", "sc-2": "JPY" },
    }

    const { result: a } = renderHook(() => useEffectiveDisplayCurrency())
    expect(a.current.displayCurrency).toBe("EUR")

    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-2", type: AccountType.SelfCustodial },
    })
    mockPersistentState = { ...mockPersistentState, activeAccountId: "sc-2" }

    const { result: b } = renderHook(() => useEffectiveDisplayCurrency())
    expect(b.current.displayCurrency).toBe("JPY")
  })
})
