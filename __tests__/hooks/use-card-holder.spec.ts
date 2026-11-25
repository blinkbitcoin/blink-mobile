import { renderHook } from "@testing-library/react-hooks"
import { useCardHolder } from "@app/hooks/use-card-holder"

const mockUseCardHolderQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardHolderQuery: (opts: Record<string, unknown>) => mockUseCardHolderQuery(opts),
}))

describe("useCardHolder", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns first name, last name, and full name when data is available", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: {
        cardHolder: {
          firstName: "Satoshi",
          lastName: "Nakamoto",
        },
      },
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.firstName).toBe("Satoshi")
    expect(result.current.lastName).toBe("Nakamoto")
    expect(result.current.fullName).toBe("Satoshi Nakamoto")
    expect(result.current.loading).toBe(false)
  })

  it("returns the date of birth and the KYC address the issuer keeps", () => {
    const address = {
      line1: "123 Main St",
      line2: "Apt 4",
      city: "Miami",
      region: "FL",
      postalCode: "33101",
      countryCode: "US",
    }
    mockUseCardHolderQuery.mockReturnValue({
      data: {
        cardHolder: {
          firstName: "Satoshi",
          lastName: "Nakamoto",
          dateOfBirth: "1971-01-03",
          address,
        },
      },
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.dateOfBirth).toBe("1971-01-03")
    expect(result.current.address).toEqual(address)
  })

  it("has neither when the issuer keeps none", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: {
        cardHolder: {
          firstName: "Satoshi",
          lastName: "Nakamoto",
          dateOfBirth: null,
          address: null,
        },
      },
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.dateOfBirth).toBeNull()
    expect(result.current.address).toBeNull()
  })

  it("returns empty strings when data is undefined", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: undefined,
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.firstName).toBe("")
    expect(result.current.lastName).toBe("")
    expect(result.current.fullName).toBe("")
  })

  it("returns loading true while query is in progress", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: undefined,
      loading: true,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.loading).toBe(true)
  })

  it("skips query when cardId is undefined", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: undefined,
      loading: false,
    })

    renderHook(() => useCardHolder(undefined))

    expect(mockUseCardHolderQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { cardId: "" },
        skip: true,
      }),
    )
  })

  it("does not skip query when cardId is provided", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: undefined,
      loading: false,
    })

    renderHook(() => useCardHolder("card-123"))

    expect(mockUseCardHolderQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { cardId: "card-123" },
        skip: false,
      }),
    )
  })

  it("uses cache-first fetch policy", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: undefined,
      loading: false,
    })

    renderHook(() => useCardHolder("card-123"))

    expect(mockUseCardHolderQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: "cache-first",
      }),
    )
  })

  it("returns empty fullName when only firstName is available", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: {
        cardHolder: {
          firstName: "Satoshi",
          lastName: null,
        },
      },
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.firstName).toBe("Satoshi")
    expect(result.current.lastName).toBe("")
    expect(result.current.fullName).toBe("")
  })

  it("returns empty fullName when only lastName is available", () => {
    mockUseCardHolderQuery.mockReturnValue({
      data: {
        cardHolder: {
          firstName: null,
          lastName: "Nakamoto",
        },
      },
      loading: false,
    })

    const { result } = renderHook(() => useCardHolder("card-123"))

    expect(result.current.firstName).toBe("")
    expect(result.current.lastName).toBe("Nakamoto")
    expect(result.current.fullName).toBe("")
  })
})
