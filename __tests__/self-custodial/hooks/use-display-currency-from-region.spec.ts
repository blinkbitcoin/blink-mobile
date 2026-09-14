import { renderHook, waitFor } from "@testing-library/react-native"

import { useDisplayCurrencyFromRegion } from "@app/self-custodial/hooks/use-display-currency-from-region"
import {
  defaultPersistentState,
  PersistentState,
} from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const mockGetCurrencies = jest.fn<string[], []>()
jest.mock("react-native-localize", () => ({
  getCurrencies: () => mockGetCurrencies(),
  getLocales: () => [],
}))

type CurrencyListResult = { data?: { currencyList: { id: string }[] } }
const mockUseCurrencyListQuery = jest.fn<CurrencyListResult, [unknown]>()
jest.mock("@app/graphql/generated", () => ({
  useCurrencyListQuery: (options: unknown) => mockUseCurrencyListQuery(options),
}))

const SELF_CUSTODIAL_ID = "self-custodial-1"

let mockPersistentState: PersistentState
const mockUpdateState = jest.fn()
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

/** What the hook actually stored, read back through the updater it handed to the context. */
const storedCurrency = (): string | undefined => {
  const update = mockUpdateState.mock.calls[0][0]
  const next: PersistentState = update(mockPersistentState)
  return next.selfCustodialDisplayCurrencyByAccountId?.[SELF_CUSTODIAL_ID]
}

describe("useDisplayCurrencyFromRegion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = {
      ...defaultPersistentState,
      activeAccountId: SELF_CUSTODIAL_ID,
    }
    mockGetCurrencies.mockReturnValue(["CRC", "USD"])
    mockUseCurrencyListQuery.mockReturnValue({
      data: { currencyList: [{ id: "USD" }, { id: "EUR" }, { id: "CRC" }] },
    })
  })

  it("gives an account with no preference the currency of its region", async () => {
    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))
    expect(storedCurrency()).toBe("CRC")
  })

  it("leaves a stored preference alone", async () => {
    mockPersistentState = {
      ...mockPersistentState,
      selfCustodialDisplayCurrencyByAccountId: { [SELF_CUSTODIAL_ID]: "USD" },
    }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not ask for the currency list once a preference is stored", () => {
    mockPersistentState = {
      ...mockPersistentState,
      selfCustodialDisplayCurrencyByAccountId: { [SELF_CUSTODIAL_ID]: "EUR" },
    }

    renderHook(() => useDisplayCurrencyFromRegion())

    expect(mockUseCurrencyListQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("asks for the currency list only while the preference is unanswered", () => {
    renderHook(() => useDisplayCurrencyFromRegion())

    expect(mockUseCurrencyListQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: false }),
    )
  })

  it("writes nothing for a custodial account", async () => {
    mockPersistentState = {
      ...mockPersistentState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("writes nothing when no account is active", async () => {
    mockPersistentState = { ...mockPersistentState, activeAccountId: undefined }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("waits for the currency list instead of guessing", async () => {
    mockUseCurrencyListQuery.mockReturnValue({ data: undefined })

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("waits rather than write from an empty currency list", async () => {
    mockUseCurrencyListQuery.mockReturnValue({ data: { currencyList: [] } })

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("leaves the fallback in place when the region's currency cannot be priced", async () => {
    mockGetCurrencies.mockReturnValue(["XBT"])

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyListQuery).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("writes under the active account without disturbing the other accounts", async () => {
    mockPersistentState = {
      ...mockPersistentState,
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-2": "GBP" },
    }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))
    const update = mockUpdateState.mock.calls[0][0]
    expect(update(mockPersistentState).selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-1": "CRC",
      "self-custodial-2": "GBP",
    })
  })

  it("writes once and stops once the account holds a currency", async () => {
    const { rerender } = renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

    mockPersistentState = {
      ...mockPersistentState,
      selfCustodialDisplayCurrencyByAccountId: { [SELF_CUSTODIAL_ID]: "CRC" },
    }
    rerender(undefined)

    await waitFor(() =>
      expect(mockUseCurrencyListQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: true }),
      ),
    )
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })
})
