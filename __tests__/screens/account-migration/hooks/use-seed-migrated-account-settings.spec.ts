import { renderHook, act } from "@testing-library/react-native"

import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const mockUseIsAuthed = jest.fn()
const mockFetchDisplayCurrency = jest.fn()
const mockFetchLanguage = jest.fn()
const mockReadQuery = jest.fn()
const mockUpdateState = jest.fn()

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ readQuery: mockReadQuery }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useDisplayCurrencyLazyQuery: () => [mockFetchDisplayCurrency],
  useLanguageLazyQuery: () => [mockFetchLanguage],
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

import { DisplayCurrencyDocument, LanguageDocument } from "@app/graphql/generated"
import { useSeedMigratedAccountSettings } from "@app/screens/account-migration/hooks/use-seed-migrated-account-settings"

const baseState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: DefaultAccountId.Custodial,
}

const seed = async (accountId = "sc-migrated-1") => {
  const { result } = renderHook(() => useSeedMigratedAccountSettings())
  await act(async () => {
    await result.current.seedMigratedSettings(accountId)
  })
}

/** Runs the updater the hook handed to updateState against a given state. */
const runCapturedUpdater = (state: PersistentState): PersistentState => {
  expect(mockUpdateState).toHaveBeenCalledTimes(1)
  const updater = mockUpdateState.mock.calls[0][0]
  return updater(state)
}

/** Answers readQuery per document, so a test can make one value cached and the other not. */
const cacheHolds = (values: { displayCurrency?: string; language?: string }) => {
  mockReadQuery.mockImplementation(({ query }: { query: unknown }) => {
    if (query === DisplayCurrencyDocument) {
      return values.displayCurrency
        ? { me: { defaultAccount: { displayCurrency: values.displayCurrency } } }
        : null
    }
    if (query === LanguageDocument) {
      return values.language ? { me: { language: values.language } } : null
    }
    return null
  })
}

describe("useSeedMigratedAccountSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockFetchDisplayCurrency.mockResolvedValue({ data: undefined })
    mockFetchLanguage.mockResolvedValue({ data: undefined })
    cacheHolds({})
  })

  it("seeds the freshly fetched currency and language under the target account id", async () => {
    mockFetchDisplayCurrency.mockResolvedValue({
      data: { me: { defaultAccount: { displayCurrency: "EUR" } } },
    })
    mockFetchLanguage.mockResolvedValue({ data: { me: { language: "es" } } })

    await seed()

    const next = runCapturedUpdater(baseState)
    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-migrated-1": "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ "sc-migrated-1": "es" })
  })

  it("copies the custodial theme from the local theme map", async () => {
    await seed()

    const next = runCapturedUpdater({
      ...baseState,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    })
    expect(next.themeByAccountId?.["sc-migrated-1"]).toBe("dark")
  })

  /** The reason the fetch exists: a resume launch reaches completion without any screen
   *  having warmed the cache, so the values have to be asked for rather than read. */
  it("fetches over the network rather than trusting the cache", async () => {
    await seed()

    expect(mockFetchDisplayCurrency).toHaveBeenCalledTimes(1)
    expect(mockFetchLanguage).toHaveBeenCalledTimes(1)
  })

  it("falls back to the cached values when the fetch rejects", async () => {
    mockFetchDisplayCurrency.mockRejectedValue(new Error("offline"))
    mockFetchLanguage.mockRejectedValue(new Error("offline"))
    cacheHolds({ displayCurrency: "EUR", language: "es" })

    await seed()

    const next = runCapturedUpdater(baseState)
    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-migrated-1": "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ "sc-migrated-1": "es" })
  })

  /** A server that accepts the request but never answers must not hold the migration
   *  open: the fetch is abandoned at the timeout and the cached values take over. */
  it("gives up on a fetch that never answers and uses the cache instead", async () => {
    jest.useFakeTimers()
    mockFetchDisplayCurrency.mockReturnValue(new Promise(() => {}))
    mockFetchLanguage.mockReturnValue(new Promise(() => {}))
    cacheHolds({ displayCurrency: "EUR", language: "es" })

    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    await act(async () => {
      const seeding = result.current.seedMigratedSettings("sc-migrated-1")
      jest.advanceTimersByTime(2000)
      await seeding
    })
    jest.useRealTimers()

    expect(runCapturedUpdater(baseState).selfCustodialDisplayCurrencyByAccountId).toEqual(
      { "sc-migrated-1": "EUR" },
    )
  })

  /** A fetch that answered for one field must not discard the other field's cached value. */
  it("merges per field when the fetch answers for only one of them", async () => {
    mockFetchDisplayCurrency.mockResolvedValue({
      data: { me: { defaultAccount: { displayCurrency: "EUR" } } },
    })
    cacheHolds({ language: "es" })

    await seed()

    const next = runCapturedUpdater(baseState)
    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-migrated-1": "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ "sc-migrated-1": "es" })
  })

  it("skips the fetch and reads the cache when the session is already gone", async () => {
    mockUseIsAuthed.mockReturnValue(false)
    cacheHolds({ displayCurrency: "EUR", language: "es" })

    await seed()

    expect(mockFetchDisplayCurrency).not.toHaveBeenCalled()
    expect(mockFetchLanguage).not.toHaveBeenCalled()
    expect(runCapturedUpdater(baseState).selfCustodialLanguageByAccountId).toEqual({
      "sc-migrated-1": "es",
    })
  })

  it("survives a cache read that throws", async () => {
    mockFetchDisplayCurrency.mockRejectedValue(new Error("offline"))
    mockFetchLanguage.mockRejectedValue(new Error("offline"))
    mockReadQuery.mockImplementation(() => {
      throw new Error("cache miss")
    })

    await seed()

    expect(runCapturedUpdater(baseState)).toBe(baseState)
  })

  it("leaves state untouched when neither the fetch nor the cache knows anything", async () => {
    await seed()

    expect(runCapturedUpdater(baseState)).toBe(baseState)
  })

  it("passes undefined state through unchanged", async () => {
    await seed()

    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater(undefined)).toBeUndefined()
  })

  /** The settings copy is a nicety riding along with the migration: it must resolve, never
   *  throw, or it would take the whole completion down with it. */
  it("resolves rather than throwing when everything fails", async () => {
    mockFetchDisplayCurrency.mockRejectedValue(new Error("offline"))
    mockFetchLanguage.mockRejectedValue(new Error("offline"))

    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    await act(async () => {
      await expect(
        result.current.seedMigratedSettings("sc-migrated-1"),
      ).resolves.toBeUndefined()
    })
  })
})
