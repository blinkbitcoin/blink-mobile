import { renderHook, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { useReplaceCard } from "@app/screens/card-screen/replace-card-screens/hooks/use-replace-card"

const mockMutate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCardReplaceMutation: () => [mockMutate, { loading: false }],
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
        ReplaceCard: {
          errors: {
            replaceFailed: () => "Failed to replace card. Please try again.",
          },
        },
      },
    },
  }),
}))

import { toastShow } from "@app/utils/toast"

describe("useReplaceCard", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("returns card data on successful replace", async () => {
    mockMutate.mockResolvedValue({
      data: {
        cardReplace: {
          lastFour: "4321",
          cardType: "VIRTUAL",
          id: "new-id",
          status: "ACTIVE",
        },
      },
      errors: undefined,
    })

    const { result } = renderHook(() => useReplaceCard())

    let replaceResult: { lastFour: string; cardType: string } | null = null
    await act(async () => {
      replaceResult = await result.current.replaceCard("card-123")
    })

    expect(replaceResult).toEqual({ lastFour: "4321", cardType: "VIRTUAL" })
    expect(mockMutate).toHaveBeenCalledWith({
      variables: { input: { cardId: "card-123" } },
    })
  })

  it("shows toast on GraphQL errors", async () => {
    mockMutate.mockResolvedValue({
      data: null,
      errors: [{ message: "Some error" }],
    })

    const { result } = renderHook(() => useReplaceCard())

    let replaceResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      replaceResult = await result.current.replaceCard("card-123")
    })

    expect(replaceResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Some error" }),
    )
  })

  it("shows toast when cardReplace is null", async () => {
    mockMutate.mockResolvedValue({
      data: { cardReplace: null },
      errors: undefined,
    })

    const { result } = renderHook(() => useReplaceCard())

    let replaceResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      replaceResult = await result.current.replaceCard("card-123")
    })

    expect(replaceResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to replace card. Please try again.",
      }),
    )
  })

  it("shows toast on network error", async () => {
    mockMutate.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useReplaceCard())

    let replaceResult: { lastFour: string; cardType: string } | null = {
      lastFour: "",
      cardType: "",
    }
    await act(async () => {
      replaceResult = await result.current.replaceCard("card-123")
    })

    expect(replaceResult).toBeNull()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error" }),
    )
  })
})
