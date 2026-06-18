import { renderHook, act } from "@testing-library/react-hooks"
import { CardStatus } from "@app/graphql/generated"
import { useCardFreeze } from "@app/screens/card-screen/card-dashboard-screen/hooks/use-card-freeze"

const mockMutate = jest.fn()
const mockToastShow = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardUpdateMutation: () => [mockMutate, { loading: false }],
}))

jest.mock("@app/graphql/utils", () => ({
  getErrorMessages: (errors: ReadonlyArray<{ message: string }>) =>
    errors.map((e) => e.message).join(", "),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardDashboard: {
          cardUpdateError: () => "Could not update card status",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useCardFreeze", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMutate.mockResolvedValue({
      data: { cardUpdate: { id: "card-1", status: "LOCKED" } },
      errors: undefined,
    })
  })

  it("returns handleFreeze and loading", () => {
    const { result } = renderHook(() => useCardFreeze())

    expect(typeof result.current.handleFreeze).toBe("function")
    expect(result.current.loading).toBe(false)
  })

  it("calls mutation with Locked status when card is Active", async () => {
    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Active)
    })

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { cardId: "card-1", status: CardStatus.Locked } },
      }),
    )
  })

  it("calls mutation with Active status when card is Locked", async () => {
    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Locked)
    })

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { cardId: "card-1", status: CardStatus.Active } },
      }),
    )
  })

  it("includes optimistic response", async () => {
    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Active)
    })

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        optimisticResponse: {
          __typename: "Mutation",
          cardUpdate: { __typename: "Card", id: "card-1", status: CardStatus.Locked },
        },
      }),
    )
  })

  it("shows toast on GraphQL errors", async () => {
    mockMutate.mockResolvedValue({
      data: null,
      errors: [{ message: "Forbidden" }],
    })

    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Active)
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Forbidden" }),
    )
  })

  it("shows toast when mutation returns no data", async () => {
    mockMutate.mockResolvedValue({ data: { cardUpdate: null }, errors: undefined })

    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Active)
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not update card status" }),
    )
  })

  it("shows toast on network error", async () => {
    mockMutate.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useCardFreeze())

    await act(async () => {
      await result.current.handleFreeze("card-1", CardStatus.Active)
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network failure" }),
    )
  })
})
