import { renderHook, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { useCardPinUpdate } from "@app/screens/card-screen/pin-screens/hooks/use-card-pin-update"

const mockMutate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCardPinUpdateMutation: () => [mockMutate, { loading: false }],
}))

let mockCard: { id: string } | undefined = { id: "card-123" }
jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => ({ card: mockCard }),
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
        PinScreens: {
          common: {
            cardNotFound: () => "Card not found. Please try again.",
            pinUpdateFailed: () => "Failed to update PIN. Please try again.",
          },
        },
      },
    },
  }),
}))

import { toastShow } from "@app/utils/toast"

describe("useCardPinUpdate", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockCard = { id: "card-123" }
  })

  it("returns true on successful mutation", async () => {
    mockMutate.mockResolvedValue({
      data: { cardPinUpdate: true },
      errors: undefined,
    })

    const { result } = renderHook(() => useCardPinUpdate())

    let success = false
    await act(async () => {
      success = await result.current.updatePin("5829")
    })

    expect(success).toBe(true)
    expect(mockMutate).toHaveBeenCalledWith({
      variables: {
        input: {
          cardId: "card-123",
          encryptedPin: "245829FFFFFFFFFF",
          iv: "",
          sessionId: "",
        },
      },
    })
  })

  it("returns false and shows toast on GQL errors", async () => {
    mockMutate.mockResolvedValue({
      data: null,
      errors: [{ message: "server error" }],
    })

    const { result } = renderHook(() => useCardPinUpdate())

    let success = true
    await act(async () => {
      success = await result.current.updatePin("5829")
    })

    expect(success).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "server error" }),
    )
  })

  it("returns false and shows toast when mutation returns false", async () => {
    mockMutate.mockResolvedValue({
      data: { cardPinUpdate: false },
      errors: undefined,
    })

    const { result } = renderHook(() => useCardPinUpdate())

    let success = true
    await act(async () => {
      success = await result.current.updatePin("5829")
    })

    expect(success).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to update PIN. Please try again.",
      }),
    )
  })

  it("returns false and shows toast when no card id", async () => {
    mockCard = undefined

    const { result } = renderHook(() => useCardPinUpdate())

    let success = true
    await act(async () => {
      success = await result.current.updatePin("5829")
    })

    expect(success).toBe(false)
    expect(mockMutate).not.toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Card not found. Please try again.",
      }),
    )
  })

  it("returns false on network error", async () => {
    mockMutate.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCardPinUpdate())

    let success = true
    await act(async () => {
      success = await result.current.updatePin("5829")
    })

    expect(success).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error" }),
    )
  })
})
