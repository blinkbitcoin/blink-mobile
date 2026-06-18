import { renderHook, act } from "@testing-library/react-hooks"

import { useCardLimits } from "@app/screens/card-screen/card-limits-screen/hooks/use-card-limits"

const mockMutate = jest.fn()
const mockToastShow = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardUpdateLimitsMutation: () => [mockMutate],
}))

jest.mock("@app/graphql/utils", () => ({
  getErrorMessages: (errors: ReadonlyArray<{ message: string }>) =>
    errors.map((e) => e.message).join(", "),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardLimits: {
          limitMustBePositive: () => "Limit must be greater than zero",
          limitUpdateSuccess: () => "Limit updated successfully",
          limitUpdateError: () => "Failed to update limit",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useCardLimits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMutate.mockResolvedValue({
      data: {
        cardUpdate: { id: "card-1", dailyLimitCents: 100000, monthlyLimitCents: 500000 },
      },
      errors: undefined,
    })
  })

  it("returns handleUpdateDailyLimit, handleUpdateMonthlyLimit, and updatingField", () => {
    const { result } = renderHook(() => useCardLimits("card-1"))

    expect(typeof result.current.handleUpdateDailyLimit).toBe("function")
    expect(typeof result.current.handleUpdateMonthlyLimit).toBe("function")
    expect(result.current.updatingField).toBeNull()
  })

  describe("handleUpdateDailyLimit", () => {
    it("calls mutation with dailyLimitCents", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { cardId: "card-1", dailyLimitCents: 100000 } },
        }),
      )
    })

    it("shows success toast on successful update", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Limit updated successfully",
          type: "success",
        }),
      )
    })

    it("sets updatingField to daily during mutation", async () => {
      let resolveMutation: (value: {
        data: { cardUpdate: { id: string } }
        errors: undefined
      }) => void
      mockMutate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve
          }),
      )

      const { result } = renderHook(() => useCardLimits("card-1"))

      act(() => {
        result.current.handleUpdateDailyLimit("1000")
      })

      expect(result.current.updatingField).toBe("daily")

      await act(async () => {
        resolveMutation!({
          data: { cardUpdate: { id: "card-1" } },
          errors: undefined,
        })
      })

      expect(result.current.updatingField).toBeNull()
    })

    it("resets updatingField after mutation completes", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(result.current.updatingField).toBeNull()
    })
  })

  describe("handleUpdateMonthlyLimit", () => {
    it("calls mutation with monthlyLimitCents", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateMonthlyLimit("5000")
      })

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { cardId: "card-1", monthlyLimitCents: 500000 } },
        }),
      )
    })
  })

  describe("validation", () => {
    it("rejects zero value with toast", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("0")
      })

      expect(mockMutate).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Limit must be greater than zero" }),
      )
    })

    it("rejects negative value with toast", async () => {
      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateMonthlyLimit("-100")
      })

      expect(mockMutate).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Limit must be greater than zero" }),
      )
    })
  })

  describe("error handling", () => {
    it("shows toast on GraphQL errors", async () => {
      mockMutate.mockResolvedValue({
        data: null,
        errors: [{ message: "Forbidden" }],
      })

      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Forbidden" }),
      )
    })

    it("shows toast when mutation returns no data", async () => {
      mockMutate.mockResolvedValue({ data: { cardUpdate: null }, errors: undefined })

      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update limit" }),
      )
    })

    it("shows toast on network error", async () => {
      mockMutate.mockRejectedValue(new Error("Network failure"))

      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network failure" }),
      )
    })

    it("resets updatingField after error", async () => {
      mockMutate.mockRejectedValue(new Error("fail"))

      const { result } = renderHook(() => useCardLimits("card-1"))

      await act(async () => {
        await result.current.handleUpdateDailyLimit("1000")
      })

      expect(result.current.updatingField).toBeNull()
    })
  })
})
