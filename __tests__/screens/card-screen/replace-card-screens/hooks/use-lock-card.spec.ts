import { renderHook, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { useLockCard } from "@app/screens/card-screen/replace-card-screens/hooks/use-lock-card"

const mockMutate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  CardStatus: { Locked: "LOCKED" },
  useCardUpdateMutation: () => [mockMutate, { loading: false }],
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
            lockFailed: () => "Failed to lock your card. Please try again.",
          },
        },
      },
    },
  }),
}))

import { toastShow } from "@app/utils/toast"

describe("useLockCard", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("returns true on successful lock", async () => {
    mockMutate.mockResolvedValue({
      data: {
        cardUpdate: { id: "card-123", status: "LOCKED", __typename: "Card" },
      },
      errors: undefined,
    })

    const { result } = renderHook(() => useLockCard())

    let lockResult = false
    await act(async () => {
      lockResult = await result.current.lockCard("card-123")
    })

    expect(lockResult).toBe(true)
    expect(mockMutate).toHaveBeenCalledWith({
      variables: { input: { cardId: "card-123", status: "LOCKED" } },
    })
  })

  it("shows toast and returns false on GraphQL errors", async () => {
    mockMutate.mockResolvedValue({
      data: null,
      errors: [{ message: "Lock error" }],
    })

    const { result } = renderHook(() => useLockCard())

    let lockResult = true
    await act(async () => {
      lockResult = await result.current.lockCard("card-123")
    })

    expect(lockResult).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Lock error" }),
    )
  })

  it("shows toast and returns false when cardUpdate is null", async () => {
    mockMutate.mockResolvedValue({
      data: { cardUpdate: null },
      errors: undefined,
    })

    const { result } = renderHook(() => useLockCard())

    let lockResult = true
    await act(async () => {
      lockResult = await result.current.lockCard("card-123")
    })

    expect(lockResult).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to lock your card. Please try again.",
      }),
    )
  })

  it("shows toast and returns false on network error", async () => {
    mockMutate.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useLockCard())

    let lockResult = true
    await act(async () => {
      lockResult = await result.current.lockCard("card-123")
    })

    expect(lockResult).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error" }),
    )
  })
})
