import { renderHook, act } from "@testing-library/react-native"

import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const mockUseIsAuthed = jest.fn()
const mockUseDisplayCurrencyQuery = jest.fn()
const mockUseLanguageQuery = jest.fn()
const mockUpdateState = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useDisplayCurrencyQuery: (...args: unknown[]) => mockUseDisplayCurrencyQuery(...args),
  useLanguageQuery: (...args: unknown[]) => mockUseLanguageQuery(...args),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

import { useSeedMigratedAccountSettings } from "@app/screens/account-migration/hooks/use-seed-migrated-account-settings"

const baseState: PersistentState = {
  schemaVersion: 15,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: DefaultAccountId.Custodial,
}

/** Runs the updater the hook handed to updateState against a given state. */
const runCapturedUpdater = (state: PersistentState): PersistentState => {
  expect(mockUpdateState).toHaveBeenCalledTimes(1)
  const updater = mockUpdateState.mock.calls[0][0]
  return updater(state)
}

describe("useSeedMigratedAccountSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseDisplayCurrencyQuery.mockReturnValue({ data: undefined })
    mockUseLanguageQuery.mockReturnValue({ data: undefined })
  })

  it("seeds the custodial currency and language under the target account id", () => {
    mockUseDisplayCurrencyQuery.mockReturnValue({
      data: { me: { defaultAccount: { displayCurrency: "EUR" } } },
    })
    mockUseLanguageQuery.mockReturnValue({ data: { me: { language: "es" } } })

    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    act(() => result.current.seedMigratedSettings("sc-migrated-1"))

    const next = runCapturedUpdater(baseState)
    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-migrated-1": "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ "sc-migrated-1": "es" })
  })

  it("copies the custodial theme from the local theme map", () => {
    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    act(() => result.current.seedMigratedSettings("sc-migrated-1"))

    const next = runCapturedUpdater({
      ...baseState,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    })
    expect(next.themeByAccountId?.["sc-migrated-1"]).toBe("dark")
  })

  it("leaves state untouched when the query data never arrived", () => {
    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    act(() => result.current.seedMigratedSettings("sc-migrated-1"))

    expect(runCapturedUpdater(baseState)).toBe(baseState)
  })

  it("passes undefined state through unchanged", () => {
    const { result } = renderHook(() => useSeedMigratedAccountSettings())
    act(() => result.current.seedMigratedSettings("sc-migrated-1"))

    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater(undefined)).toBeUndefined()
  })

  it("warms both queries cache-first while the custodial session is authed", () => {
    renderHook(() => useSeedMigratedAccountSettings())

    expect(mockUseDisplayCurrencyQuery).toHaveBeenCalledWith({
      fetchPolicy: "cache-first",
      skip: false,
    })
    expect(mockUseLanguageQuery).toHaveBeenCalledWith({
      fetchPolicy: "cache-first",
      skip: false,
    })
  })

  it("skips both queries when unauthed", () => {
    mockUseIsAuthed.mockReturnValue(false)

    renderHook(() => useSeedMigratedAccountSettings())

    expect(mockUseDisplayCurrencyQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
    expect(mockUseLanguageQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })
})
