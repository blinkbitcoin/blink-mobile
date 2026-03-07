import { renderHook } from "@testing-library/react-hooks"

import { useShippingAddressData } from "@app/screens/card-screen/card-shipping-address-screen/hooks/use-shipping-address-data"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUsePersonalDetailsQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePersonalDetailsQuery: (opts: Record<string, unknown>) =>
    mockUsePersonalDetailsQuery(opts),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: {} }),
}))

const mockShippingAddress = {
  firstName: "Joe",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "USA",
  country: "United States",
  phoneNumber: "+1234567890",
}

const mockData = {
  me: {
    id: "user-1",
    defaultAccount: {
      id: "acct-1",
      cards: [
        {
          id: "card-1",
          shippingAddress: mockShippingAddress,
        },
      ],
    },
  },
}

describe("useShippingAddressData", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
  })

  it("returns loading state", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    const { result } = renderHook(() => useShippingAddressData())

    expect(result.current.initialAddress).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it("maps GQL fields to form ShippingAddress", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: mockData,
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useShippingAddressData())

    expect(result.current.initialAddress).toEqual({
      firstName: "Joe",
      lastName: "Nakamoto",
      line1: "123 Main Street",
      line2: "Apt 4B",
      city: "New York",
      region: "NY",
      postalCode: "10001",
      countryCode: "USA",
    })
  })

  it("maps nullable fields to empty strings", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: {
        me: {
          id: "user-1",
          defaultAccount: {
            id: "acct-1",
            cards: [
              {
                id: "card-1",
                shippingAddress: {
                  ...mockShippingAddress,
                  firstName: null,
                  lastName: null,
                  line2: null,
                },
              },
            ],
          },
        },
      },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useShippingAddressData())

    expect(result.current.initialAddress?.firstName).toBe("")
    expect(result.current.initialAddress?.lastName).toBe("")
    expect(result.current.initialAddress?.line2).toBe("")
  })

  it("returns null when no shipping address exists", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: {
        me: {
          id: "user-1",
          defaultAccount: {
            id: "acct-1",
            cards: [{ id: "card-1", shippingAddress: null }],
          },
        },
      },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useShippingAddressData())

    expect(result.current.initialAddress).toBeNull()
  })

  it("returns null when no cards exist", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: {
        me: {
          id: "user-1",
          defaultAccount: { id: "acct-1", cards: [] },
        },
      },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useShippingAddressData())

    expect(result.current.initialAddress).toBeNull()
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useShippingAddressData())

    expect(mockUsePersonalDetailsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("uses cache-first fetch policy", () => {
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    renderHook(() => useShippingAddressData())

    expect(mockUsePersonalDetailsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "cache-first" }),
    )
  })

  it("shows error toast on query error", () => {
    const mockError = new Error("Network error")
    mockUsePersonalDetailsQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
    })

    renderHook(() => useShippingAddressData())

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error", type: "warning" }),
    )
  })
})
