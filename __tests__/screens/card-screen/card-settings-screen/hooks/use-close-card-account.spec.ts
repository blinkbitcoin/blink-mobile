import { renderHook, act } from "@testing-library/react-hooks"
import { CardStatus } from "@app/graphql/generated"
import { useCloseCardAccount } from "@app/screens/card-screen/card-settings-screen/hooks"

const mockCardUpdateMutation = jest.fn()
const mockToastShow = jest.fn()
const mockReplace = jest.fn()
const mockUseCardData = jest.fn()

jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardUpdateMutation: () => [mockCardUpdateMutation, { loading: false }],
  useCardBalanceQuery: () => ({
    data: {
      cardBalance: {
        pending: 0,
        available: 50000,
      },
    },
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/graphql/utils", () => ({
  getErrorMessages: (errors: readonly { message: string }[]) =>
    errors.map((e) => e.message).join(", "),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    moneyAmountToDisplayCurrencyString: () => "~$15.00",
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardSettings: {
          closeCardError: () => "Failed to close card account",
          closeCardSuccessTitle: () => "Card Account Closed",
          closeCardSuccessSubtitle: () => "Your Visa card has been permanently closed.",
          closeCardSuccessButton: () => "Back to Home",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (opts: { message: string }) => mockToastShow(opts),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    replace: mockReplace,
  }),
}))

jest.mock("@app/types/amounts", () => ({
  toBtcMoneyAmount: (sats: number) => ({ amount: sats, currency: "BTC" }),
}))

describe("useCloseCardAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCardData.mockReturnValue({ card: { id: "card-123" }, hasPhysicalCard: false })
  })

  it("returns expected shape", () => {
    const { result } = renderHook(() => useCloseCardAccount())

    expect(typeof result.current.closeCard).toBe("function")
    expect(typeof result.current.loading).toBe("boolean")
    expect(typeof result.current.hasPendingTransactions).toBe("boolean")
    expect(typeof result.current.hasPositiveBalance).toBe("boolean")
    expect(typeof result.current.balanceDisplay).toBe("string")
  })

  it("detects positive balance from available sats", () => {
    const { result } = renderHook(() => useCloseCardAccount())

    expect(result.current.hasPositiveBalance).toBe(true)
    expect(result.current.balanceDisplay).toBe("~$15.00")
  })

  it("detects no pending transactions when pending is 0", () => {
    const { result } = renderHook(() => useCloseCardAccount())

    expect(result.current.hasPendingTransactions).toBe(false)
  })

  it("does nothing when card is not available", async () => {
    mockUseCardData.mockReturnValue({ card: null, hasPhysicalCard: false })

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockCardUpdateMutation).not.toHaveBeenCalled()
  })

  it("calls cardUpdateMutation with correct variables", async () => {
    mockCardUpdateMutation.mockResolvedValue({
      data: { cardUpdate: { id: "card-123", status: CardStatus.Canceled } },
    })

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockCardUpdateMutation).toHaveBeenCalledWith({
      variables: { input: { cardId: "card-123", status: CardStatus.Canceled } },
    })
  })

  it("navigates to cardStatusScreen on success", async () => {
    mockCardUpdateMutation.mockResolvedValue({
      data: { cardUpdate: { id: "card-123", status: CardStatus.Canceled } },
    })

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", {
      title: "Card Account Closed",
      subtitle: "Your Visa card has been permanently closed.",
      buttonLabel: "Back to Home",
      navigateTo: "Primary",
      iconName: "info",
      iconColor: undefined,
    })
  })

  it("shows toast on GraphQL errors", async () => {
    mockCardUpdateMutation.mockResolvedValue({
      data: null,
      errors: [{ message: "Card not found" }],
    })

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Card not found" }),
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("shows warning toast when cardUpdate returns null", async () => {
    mockCardUpdateMutation.mockResolvedValue({
      data: { cardUpdate: null },
    })

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to close card account",
        type: "warning",
      }),
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("shows toast on thrown error", async () => {
    mockCardUpdateMutation.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useCloseCardAccount())

    await act(async () => {
      await result.current.closeCard()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network failure" }),
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
