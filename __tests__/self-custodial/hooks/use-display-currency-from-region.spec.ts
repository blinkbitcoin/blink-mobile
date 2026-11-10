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

type CurrencyListResult = {
  currencyList: { id: string }[]
  loading: boolean
  isUnavailable: boolean
}
/** The list now reaches this hook through the shared adapter, which picks between the
 *  Breez feed and the backend query. Which source answered is that adapter's concern;
 *  this suite is about what the hook writes once one has. */
const mockUseCurrencyList = jest.fn<CurrencyListResult, []>()
jest.mock("@app/hooks/use-currency-list", () => ({
  useCurrencyList: () => mockUseCurrencyList(),
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
    mockUseCurrencyList.mockReturnValue({
      currencyList: [{ id: "USD" }, { id: "EUR" }, { id: "CRC" }],
      loading: false,
      isUnavailable: false,
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

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("writes a region default off a list the backend never served", async () => {
    // The point of sourcing the list from the SDK: a restored wallet still lands on its
    // region's currency with Blink unreachable.
    mockUseCurrencyList.mockReturnValue({
      currencyList: [{ id: "USD" }, { id: "CRC" }],
      loading: false,
      isUnavailable: false,
    })

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))
    expect(storedCurrency()).toBe("CRC")
  })

  it("writes nothing for a custodial account", async () => {
    mockPersistentState = {
      ...mockPersistentState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("writes nothing when no account is active", async () => {
    mockPersistentState = { ...mockPersistentState, activeAccountId: undefined }

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("waits for the currency list instead of guessing", async () => {
    mockUseCurrencyList.mockReturnValue({
      currencyList: [],
      loading: true,
      isUnavailable: false,
    })

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("waits rather than write from an empty currency list", async () => {
    mockUseCurrencyList.mockReturnValue({
      currencyList: [],
      loading: false,
      isUnavailable: true,
    })

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("leaves the fallback in place when the region's currency cannot be priced", async () => {
    mockGetCurrencies.mockReturnValue(["XBT"])

    renderHook(() => useDisplayCurrencyFromRegion())

    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
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

    // Still only the one write: the answered preference is what stops the second, not
    // the absence of a list.
    await waitFor(() => expect(mockUseCurrencyList).toHaveBeenCalled())
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })
})
