import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { renderHook } from "@testing-library/react-hooks"

import { useCurrencyList } from "@app/hooks/use-currency-list"
import { AccountType } from "@app/types/wallet"

const mockUseCurrencyListQuery = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseFiatRates = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useCurrencyListQuery: (options: unknown) => mockUseCurrencyListQuery(options),
}))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))
jest.mock("@app/self-custodial/providers/fiat-rates", () => ({
  useFiatRates: () => mockUseFiatRates(),
}))

/** Breez's own wording, which is the raw ISO 4217 column: inconsistent, and for some
 *  currencies in the issuing country's language ("Peso Colombiano"). */
const sdkList = [
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
  { id: "NGN", flag: "🇳🇬", name: "Naira", symbol: "₦", fractionDigits: 2 },
  { id: "COP", flag: "🇨🇴", name: "Peso Colombiano", symbol: "$", fractionDigits: 2 },
]

const backendList = [
  { id: "EUR", flag: "🇪🇺", name: "Euro", symbol: "€", fractionDigits: 2 },
]

/** What the backend answers for the same codes the SDK carries. */
const backendNames = [
  { id: "NGN", flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦", fractionDigits: 2 },
  { id: "COP", flag: "🇨🇴", name: "Colombian Peso", symbol: "$", fractionDigits: 2 },
]

const selfCustodial = () =>
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: "self-custodial-1", type: AccountType.SelfCustodial },
  })

const custodial = () =>
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: "custodial-1", type: AccountType.Custodial },
  })

const fiatRates = (currencies: typeof sdkList, hasSettled = true) =>
  mockUseFiatRates.mockReturnValue({ currencies, hasSettled })

describe("useCurrencyList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    custodial()
    fiatRates([])
    mockUseCurrencyListQuery.mockReturnValue({ data: undefined, loading: false })
  })

  it("serves the SDK list to a self-custodial account", () => {
    selfCustodial()
    fiatRates(sdkList)

    const { result } = renderHook(() => useCurrencyList())

    expect(result.current.currencyList).toEqual(sdkList)
    expect(result.current.loading).toBe(false)
  })

  it("still asks the backend when the SDK has a list, for the wording", () => {
    // Breez carries the raw ISO 4217 names; the backend's are the uniformly
    // country-qualified ones the picker has always shown.
    selfCustodial()
    fiatRates(sdkList)

    renderHook(() => useCurrencyList())

    expect(mockUseCurrencyListQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "cache-and-network" }),
    )
  })

  describe("wording", () => {
    it("takes the backend's names over the SDK's", () => {
      selfCustodial()
      fiatRates(sdkList)
      mockUseCurrencyListQuery.mockReturnValue({
        data: { currencyList: backendNames },
        loading: false,
      })

      const { result } = renderHook(() => useCurrencyList())
      const byId = (id: string) => result.current.currencyList.find((c) => c.id === id)

      expect(byId("NGN")?.name).toBe("Nigerian Naira")
      expect(byId("COP")?.name).toBe("Colombian Peso")
    })

    it("keeps the SDK's membership, not the backend's", () => {
      // The SDK list is what can still be priced offline; the overlay only renames.
      selfCustodial()
      fiatRates(sdkList)
      mockUseCurrencyListQuery.mockReturnValue({
        data: { currencyList: backendNames },
        loading: false,
      })

      const { result } = renderHook(() => useCurrencyList())

      expect(result.current.currencyList.map((c) => c.id)).toEqual(["USD", "NGN", "COP"])
    })

    it("falls back to the SDK's wording when the backend is unreachable", () => {
      selfCustodial()
      fiatRates(sdkList)
      mockUseCurrencyListQuery.mockReturnValue({ data: undefined, loading: false })

      const { result } = renderHook(() => useCurrencyList())

      expect(result.current.currencyList.find((c) => c.id === "NGN")?.name).toBe("Naira")
    })
  })

  it("keeps a custodial account on the backend list even when an SDK list exists", () => {
    // A second wallet on the device may have fetched one; it is not this account's.
    custodial()
    fiatRates(sdkList)
    mockUseCurrencyListQuery.mockReturnValue({
      data: { currencyList: backendList },
      loading: false,
    })

    const { result } = renderHook(() => useCurrencyList())

    expect(result.current.currencyList).toEqual(backendList)
  })

  it("falls back to the backend while the SDK has served nothing", () => {
    selfCustodial()
    fiatRates([])
    mockUseCurrencyListQuery.mockReturnValue({
      data: { currencyList: backendList },
      loading: false,
    })

    const { result } = renderHook(() => useCurrencyList())

    // The query carries no `skip` any more: it is asked whenever the backend is
    // reachable, because it is the authority on the wording even when the SDK has
    // supplied the list itself.
    expect(result.current.currencyList).toEqual(backendList)
  })

  it("reports Unavailable when both sources have finished empty", () => {
    selfCustodial()
    fiatRates([], true)
    mockUseCurrencyListQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useCurrencyList())

    // The picker must say so rather than spin: nothing else is coming.
    expect(result.current.isUnavailable).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it("stays loading while the SDK has not settled", () => {
    selfCustodial()
    fiatRates([], false)
    mockUseCurrencyListQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderHook(() => useCurrencyList())

    expect(result.current.isUnavailable).toBe(false)
    expect(result.current.loading).toBe(true)
  })

  it("never reports Unavailable for a custodial account", () => {
    // Its only source is the backend, and a query that has stopped loading may still be
    // retried; today's behaviour there is to keep waiting.
    custodial()
    mockUseCurrencyListQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useCurrencyList())

    expect(result.current.isUnavailable).toBe(false)
  })
})
