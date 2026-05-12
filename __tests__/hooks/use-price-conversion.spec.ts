// sort-imports-ignore

import { useRealtimePriceQuery } from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"

type MockUseRealtimePriceResponse = Pick<ReturnType<typeof useRealtimePriceQuery>, "data">
const mockUseRealtimePriceQuery = jest.fn<
  MockUseRealtimePriceResponse,
  Parameters<typeof useRealtimePriceQuery>
>()
const mockUseRealtimePriceUnauthedQuery = jest.fn().mockReturnValue({ data: undefined })
const mockUseAccountRegistry = jest.fn().mockReturnValue({ activeAccount: undefined })
const mockUseEffectiveDisplayCurrency = jest.fn().mockReturnValue({
  displayCurrency: "NGN",
  setDisplayCurrency: jest.fn(),
  loading: false,
})

import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  BtcMoneyAmount,
  DisplayAmount,
  DisplayCurrency,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  UsdMoneyAmount,
} from "@app/types/amounts"
import { renderHook } from "@testing-library/react-hooks"

jest.mock("@app/graphql/generated", () => {
  return {
    ...jest.requireActual("@app/graphql/generated"),
    useRealtimePriceQuery: mockUseRealtimePriceQuery,
    useRealtimePriceUnauthedQuery: (...args: unknown[]) =>
      mockUseRealtimePriceUnauthedQuery(...args),
  }
})

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))
jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => mockUseEffectiveDisplayCurrency(),
}))

const mockPriceData: MockUseRealtimePriceResponse = {
  data: {
    __typename: "Query",
    me: {
      id: "f2b1d23f-816c-51db-aea4-4b773cfdf7a7",
      __typename: "User",
      defaultAccount: {
        __typename: "ConsumerAccount",
        id: "f2b1d0bf-816c-51db-aea4-4b773cfdf7a7",
        realtimePrice: {
          __typename: "RealtimePrice",
          btcSatPrice: {
            __typename: "PriceOfOneSatInMinorUnit",
            base: 10118784000000,
            offset: 12,
          },
          denominatorCurrency: "NGN",
          id: "f2b1d0bf-816c-51db-aea4-4b773cfdf7a7",
          timestamp: 1678314952,
          usdCentPrice: {
            __typename: "PriceOfOneUsdCentInMinorUnit",
            base: 460434879,
            offset: 6,
          },
        },
      },
    },
  },
}

const oneThousandDollars: UsdMoneyAmount = toUsdMoneyAmount(100000) // $1,000
const oneThousandDollarsInSats: BtcMoneyAmount = toBtcMoneyAmount(4550299) // 4,550,299 sats
const oneThousandDollarsInNairaMinorUnits: DisplayAmount = {
  amount: 46043488,
  currency: DisplayCurrency,
  currencyCode: "NGN",
} // 460,434.88 Naira

const amounts = {
  oneThousandDollars,
  oneThousandDollarsInSats,
  oneThousandDollarsInNairaMinorUnits,
}

describe("usePriceConversion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })
    mockUseEffectiveDisplayCurrency.mockReturnValue({
      displayCurrency: "NGN",
      setDisplayCurrency: jest.fn(),
      loading: false,
    })
    mockUseRealtimePriceUnauthedQuery.mockReturnValue({ data: undefined })
  })

  it("should return null fields when no price is provided", () => {
    mockUseRealtimePriceQuery.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => usePriceConversion())
    expect(result.current).toEqual(
      expect.objectContaining({
        convertMoneyAmount: undefined,
        usdPerSat: null,
      }),
    )
  })

  describe("convertMoneyAmount", () => {
    mockUseRealtimePriceQuery.mockReturnValue(mockPriceData)

    const { result } = renderHook(() => usePriceConversion())
    const convertMoneyAmount = result.current.convertMoneyAmount
    if (!convertMoneyAmount) {
      throw new Error("convertMoneyAmount is undefined")
    }

    it("should make proper conversions", () => {
      // test all conversions
      for (const fromCurrency of Object.keys(amounts)) {
        for (const toCurrency of Object.keys(amounts)) {
          const fromAmount = amounts[fromCurrency as keyof typeof amounts]
          const toAmount = amounts[toCurrency as keyof typeof amounts]

          const convertedAmount = convertMoneyAmount(fromAmount, toAmount.currency)
          // expect amounts to be within .01% of each other due to rounding
          expect(
            (toAmount.amount - convertedAmount.amount) / convertedAmount.amount,
          ).toBeLessThan(0.0001)
        }
      }
    })

    it("should return input if the toCurrency is the same", () => {
      const amountsArray = Object.values(amounts)

      amountsArray.forEach((amount) => {
        expect(convertMoneyAmount(amount, amount.currency)).toBe(amount)
      })
    })
  })

  describe("displayCurrency", () => {
    it("comes from the effective adapter, not from the realtime price", () => {
      mockUseRealtimePriceQuery.mockReturnValue(mockPriceData)
      mockUseEffectiveDisplayCurrency.mockReturnValue({
        displayCurrency: "EUR",
        setDisplayCurrency: jest.fn(),
        loading: false,
      })

      const { result } = renderHook(() => usePriceConversion())

      expect(result.current.displayCurrency).toBe("EUR")
    })
  })

  describe("fetchPolicy", () => {
    it("authed query uses cache-and-network so account switches refresh", () => {
      mockUseRealtimePriceQuery.mockReturnValue({ data: undefined })

      renderHook(() => usePriceConversion())

      expect(mockUseRealtimePriceQuery).toHaveBeenCalledWith(
        expect.objectContaining({ fetchPolicy: "cache-and-network" }),
      )
    })

    it("unauthed query uses cache-and-network so currency changes refresh", () => {
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      })
      mockUseRealtimePriceQuery.mockReturnValue({ data: undefined })

      renderHook(() => usePriceConversion())

      expect(mockUseRealtimePriceUnauthedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ fetchPolicy: "cache-and-network" }),
      )
    })
  })

  describe("self-custodial isolation", () => {
    beforeEach(() => {
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      })
    })

    it("skips the authed query when active account is self-custodial", () => {
      mockUseRealtimePriceQuery.mockReturnValue({ data: undefined })

      renderHook(() => usePriceConversion())

      expect(mockUseRealtimePriceQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("forwards the effective display currency to the unauthed query", () => {
      mockUseRealtimePriceQuery.mockReturnValue({ data: undefined })
      mockUseEffectiveDisplayCurrency.mockReturnValue({
        displayCurrency: "JPY",
        setDisplayCurrency: jest.fn(),
        loading: false,
      })

      renderHook(() => usePriceConversion())

      expect(mockUseRealtimePriceUnauthedQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
          variables: { currency: "JPY" },
        }),
      )
    })

    it("ignores a stale authed price even if the cache still serves it", () => {
      mockUseRealtimePriceQuery.mockReturnValue(mockPriceData)
      mockUseRealtimePriceUnauthedQuery.mockReturnValue({ data: undefined })

      const { result } = renderHook(() => usePriceConversion())

      expect(result.current.convertMoneyAmount).toBeUndefined()
      expect(result.current.usdPerSat).toBeNull()
    })
  })

  describe("cached-currency guard", () => {
    it("discards a price whose denominatorCurrency differs from the preference", () => {
      mockUseRealtimePriceQuery.mockReturnValue(mockPriceData)
      mockUseEffectiveDisplayCurrency.mockReturnValue({
        displayCurrency: "EUR",
        setDisplayCurrency: jest.fn(),
        loading: false,
      })

      const { result } = renderHook(() => usePriceConversion())

      expect(result.current.convertMoneyAmount).toBeUndefined()
    })

    it("trusts a price whose denominatorCurrency matches the preference", () => {
      mockUseRealtimePriceQuery.mockReturnValue(mockPriceData)
      mockUseEffectiveDisplayCurrency.mockReturnValue({
        displayCurrency: "NGN",
        setDisplayCurrency: jest.fn(),
        loading: false,
      })

      const { result } = renderHook(() => usePriceConversion())

      expect(result.current.convertMoneyAmount).toBeDefined()
    })
  })
})
