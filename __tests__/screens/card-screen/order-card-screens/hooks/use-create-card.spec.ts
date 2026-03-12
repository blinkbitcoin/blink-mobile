import { renderHook, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { useCreateCard } from "@app/screens/card-screen/order-card-screens/hooks/use-create-card"
import { toastShow } from "@app/utils/toast"

const mockMutate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  CardType: { Physical: "PHYSICAL" },
  useCardCreateMutation: () => [mockMutate, { loading: false }],
}))

jest.mock("@app/graphql/utils", () => ({
  getErrorMessages: (errors: { message: string }[]) =>
    errors.map((e) => e.message).join(", "),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        OrderPhysicalCard: {
          errors: {
            createFailed: () => "Failed to order your physical card. Please try again.",
          },
        },
      },
    },
  }),
}))

const mockShippingAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "USA",
  phoneNumber: "",
}

describe("useCreateCard", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("returns card data on successful create", async () => {
    mockMutate.mockResolvedValue({
      data: {
        cardCreate: {
          lastFour: "5678",
          cardType: "PHYSICAL",
          id: "new-id",
          status: "ACTIVE",
        },
      },
      errors: undefined,
    })

    const { result } = renderHook(() => useCreateCard())

    let createResult: { lastFour: string; cardType: string } | null = null
    await act(async () => {
      createResult = await result.current.createCard({
        applicationId: "app-123",
        shippingAddress: mockShippingAddress,
      })
    })

    expect(createResult).toEqual({ lastFour: "5678", cardType: "PHYSICAL" })
    expect(mockMutate).toHaveBeenCalledWith({
      variables: {
        input: {
          applicationId: "app-123",
          cardType: "PHYSICAL",
          shippingAddress: mockShippingAddress,
        },
      },
    })
  })

  it("shows toast on GraphQL errors", async () => {
    mockMutate.mockResolvedValue({
      data: null,
      errors: [{ message: "Some error" }],
    })

    const { result } = renderHook(() => useCreateCard())

    let createResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      createResult = await result.current.createCard({
        applicationId: "app-123",
        shippingAddress: mockShippingAddress,
      })
    })

    expect(createResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Some error" }),
    )
  })

  it("shows toast when cardCreate is null", async () => {
    mockMutate.mockResolvedValue({
      data: { cardCreate: null },
      errors: undefined,
    })

    const { result } = renderHook(() => useCreateCard())

    let createResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      createResult = await result.current.createCard({
        applicationId: "app-123",
        shippingAddress: mockShippingAddress,
      })
    })

    expect(createResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to order your physical card. Please try again.",
      }),
    )
  })

  it("shows toast on network error", async () => {
    mockMutate.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCreateCard())

    let createResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      createResult = await result.current.createCard({
        applicationId: "app-123",
        shippingAddress: mockShippingAddress,
      })
    })

    expect(createResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error" }),
    )
  })
})
