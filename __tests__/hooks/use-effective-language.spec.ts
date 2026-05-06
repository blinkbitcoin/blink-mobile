import { renderHook, act } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

const mockUseIsAuthed = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseLanguageQuery = jest.fn()
const mockUpdateLanguageMutation = jest.fn()
const mockUseUserUpdateLanguageMutation = jest.fn(
  (): [typeof mockUpdateLanguageMutation, { loading: boolean }] => [
    mockUpdateLanguageMutation,
    { loading: false },
  ],
)
const mockUpdateState = jest.fn()
let mockPersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: undefined as string | undefined,
  selfCustodialLanguageByAccountId: undefined as Record<string, string> | undefined,
}

jest.mock("@app/graphql/generated", () => ({
  useLanguageQuery: (...args: unknown[]) => mockUseLanguageQuery(...args),
  useUserUpdateLanguageMutation: () => mockUseUserUpdateLanguageMutation(),
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

import { useEffectiveLanguage } from "@app/hooks/use-effective-language"

describe("useEffectiveLanguage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = {
      schemaVersion: 11,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: undefined,
      selfCustodialLanguageByAccountId: undefined,
    }
    mockUseLanguageQuery.mockReturnValue({ data: undefined, loading: false })
  })

  describe("custodial path", () => {
    beforeEach(() => {
      mockUseIsAuthed.mockReturnValue(true)
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { type: AccountType.Custodial },
      })
    })

    it("reads language from the GraphQL query", () => {
      mockUseLanguageQuery.mockReturnValue({
        data: { me: { language: "es" } },
        loading: false,
      })

      const { result } = renderHook(() => useEffectiveLanguage())

      expect(result.current.language).toBe("es")
    })

    it("falls back to DEFAULT when query data is missing", () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      expect(result.current.language).toBe("DEFAULT")
    })

    it("does not skip the query when authed and custodial", () => {
      renderHook(() => useEffectiveLanguage())

      expect(mockUseLanguageQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      )
    })

    it("setLanguage runs the GraphQL mutation", async () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      await act(async () => {
        await result.current.setLanguage("fr")
      })

      expect(mockUpdateLanguageMutation).toHaveBeenCalledWith({
        variables: { input: { language: "fr" } },
      })
    })

    it("setLanguage does not write to persistent state", async () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      await act(async () => {
        await result.current.setLanguage("fr")
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

    it("reads language from the per-account persistent map", () => {
      mockPersistentState.selfCustodialLanguageByAccountId = { "sc-1": "ja" }

      const { result } = renderHook(() => useEffectiveLanguage())

      expect(result.current.language).toBe("ja")
    })

    it("falls back to DEFAULT when no per-account value is set", () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      expect(result.current.language).toBe("DEFAULT")
    })

    it("skips the GraphQL query in self-custodial mode", () => {
      renderHook(() => useEffectiveLanguage())

      expect(mockUseLanguageQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("setLanguage writes to persistent state under the active id", async () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      await act(async () => {
        await result.current.setLanguage("ja")
      })

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater(mockPersistentState)
      expect(next.selfCustodialLanguageByAccountId).toEqual({ "sc-1": "ja" })
    })

    it("setLanguage does not call the GraphQL mutation", async () => {
      const { result } = renderHook(() => useEffectiveLanguage())

      await act(async () => {
        await result.current.setLanguage("ja")
      })

      expect(mockUpdateLanguageMutation).not.toHaveBeenCalled()
    })

    it("loading is false even while custodial query reports loading", () => {
      mockUseLanguageQuery.mockReturnValue({ data: undefined, loading: true })

      const { result } = renderHook(() => useEffectiveLanguage())

      expect(result.current.loading).toBe(false)
    })
  })

  it("isolates per-account language when switching active SC accounts", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    })
    mockPersistentState = {
      ...mockPersistentState,
      activeAccountId: "sc-1",
      selfCustodialLanguageByAccountId: { "sc-1": "es", "sc-2": "fr" },
    }

    const { result: a } = renderHook(() => useEffectiveLanguage())
    expect(a.current.language).toBe("es")

    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-2", type: AccountType.SelfCustodial },
    })
    mockPersistentState = { ...mockPersistentState, activeAccountId: "sc-2" }

    const { result: b } = renderHook(() => useEffectiveLanguage())
    expect(b.current.language).toBe("fr")
  })
})
