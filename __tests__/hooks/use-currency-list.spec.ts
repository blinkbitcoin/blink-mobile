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

const sdkList = [
  { id: "USD", flag: "🇺🇸", name: "US Dollar", symbol: "$", fractionDigits: 2 },
  { id: "NGN", flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦", fractionDigits: 2 },
]

const backendList = [
  { id: "EUR", flag: "🇪🇺", name: "Euro", symbol: "€", fractionDigits: 2 },
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

  it("stops asking the backend once the SDK has a list", () => {
    selfCustodial()
    fiatRates(sdkList)

    renderHook(() => useCurrencyList())

    expect(mockUseCurrencyListQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
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

    expect(result.current.currencyList).toEqual(backendList)
    expect(mockUseCurrencyListQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: false }),
    )
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
