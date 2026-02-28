import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDashboardScreen } from "@app/screens/card-screen/card-dashboard-screen"
import { CardStatus } from "@app/graphql/generated"
import { ContextForScreen } from "../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

const mockSetOptions = jest.fn()
const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      setOptions: mockSetOptions,
    }),
    useIsFocused: () => true,
  }
})

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const mockUseCardData = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

const mockUseCardBalance = jest.fn()
jest.mock(
  "@app/screens/card-screen/card-dashboard-screen/hooks/use-card-balance",
  () => ({
    useCardBalance: (cardId: string | undefined) => mockUseCardBalance(cardId),
  }),
)

const mockUseCardFreeze = jest.fn()
jest.mock("@app/screens/card-screen/card-dashboard-screen/hooks/use-card-freeze", () => ({
  useCardFreeze: () => mockUseCardFreeze(),
}))

const mockUseCardTransactions = jest.fn()
jest.mock(
  "@app/screens/card-screen/card-dashboard-screen/hooks/use-card-transactions",
  () => ({
    useCardTransactions: (cardId: string | undefined) => mockUseCardTransactions(cardId),
  }),
)

type CardFixture = {
  id: string
  lastFour: string
  status: CardStatus
  cardType: string
  createdAt: string
}

const activeCard: CardFixture = {
  id: "card-1",
  lastFour: "4242",
  status: CardStatus.Active,
  cardType: "VIRTUAL",
  createdAt: "2024-01-01T00:00:00Z",
}

const lockedCard: CardFixture = {
  ...activeCard,
  status: CardStatus.Locked,
}

const canceledCard: CardFixture = {
  ...activeCard,
  status: CardStatus.Canceled,
}

const defaultCardData = {
  card: activeCard,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
}

const defaultBalance = {
  balancePrimary: "$100.00",
  balanceSecondary: "~ 0.0015 BTC",
  loading: false,
  error: undefined,
}

const mockHandleLoadMore = jest.fn()
const mockRefetch = jest.fn()
const mockHandleFreeze = jest.fn()

const defaultTransactions = {
  transactions: [
    {
      date: "Today",
      transactions: [
        {
          id: "tx-1",
          merchantName: "Coffee Shop",
          timeAgo: "2 hours ago",
          amount: "$5.50",
          status: "completed" as const,
        },
        {
          id: "tx-2",
          merchantName: "Grocery Store",
          timeAgo: "5 hours ago",
          amount: "$25.00",
          status: "pending" as const,
        },
      ],
    },
    {
      date: "Yesterday",
      transactions: [
        {
          id: "tx-3",
          merchantName: "Restaurant",
          timeAgo: "1 day ago",
          amount: "$42.00",
          status: "completed" as const,
        },
      ],
    },
  ],
  loading: false,
  handleLoadMore: mockHandleLoadMore,
  hasMore: true,
  fetchingMore: false,
  refetch: mockRefetch,
}

const defaultFreeze = {
  handleFreeze: mockHandleFreeze,
  loading: false,
}

const setupMocks = (overrides?: {
  cardData?: Partial<typeof defaultCardData>
  balance?: Partial<typeof defaultBalance>
  transactions?: Partial<typeof defaultTransactions>
  freeze?: Partial<typeof defaultFreeze>
}) => {
  mockUseCardData.mockReturnValue({ ...defaultCardData, ...overrides?.cardData })
  mockUseCardBalance.mockReturnValue({ ...defaultBalance, ...overrides?.balance })
  mockUseCardTransactions.mockReturnValue({
    ...defaultTransactions,
    ...overrides?.transactions,
  })
  mockUseCardFreeze.mockReturnValue({ ...defaultFreeze, ...overrides?.freeze })
}

describe("CardDashboardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    setupMocks()
  })

  describe("loading state", () => {
    it("shows loading indicator when card data is loading", async () => {
      setupMocks({ cardData: { loading: true, card: undefined } })

      const { toJSON } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("empty states", () => {
    it("shows no card message when card is null", async () => {
      setupMocks({ cardData: { card: undefined, loading: false } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("No cards available")).toBeTruthy()
    })

    it("shows not usable message for canceled card", async () => {
      setupMocks({ cardData: { card: canceledCard } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("This card is not currently available for use")).toBeTruthy()
    })
  })

  describe("active card rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays masked card number", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("•••• •••• •••• 4242")).toBeTruthy()
    })

    it("displays balance", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$100.00")).toBeTruthy()
      expect(getByText("~ 0.0015 BTC")).toBeTruthy()
    })

    it("displays all action buttons", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Details")).toBeTruthy()
      expect(getByText("Freeze")).toBeTruthy()
      expect(getByText("Set limits")).toBeTruthy()
      expect(getByText("Statements")).toBeTruthy()
    })

    it("displays transactions title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Transactions")).toBeTruthy()
    })

    it("displays transaction date groups", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Today")).toBeTruthy()
      expect(getByText("Yesterday")).toBeTruthy()
    })

    it("displays transaction merchant names", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Coffee Shop")).toBeTruthy()
      expect(getByText("Grocery Store")).toBeTruthy()
      expect(getByText("Restaurant")).toBeTruthy()
    })

    it("displays transaction amounts", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$5.50")).toBeTruthy()
      expect(getByText("$25.00")).toBeTruthy()
      expect(getByText("$42.00")).toBeTruthy()
    })

    it("displays add funds button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add funds")).toBeTruthy()
    })
  })

  describe("frozen card rendering", () => {
    it("renders frozen card state", async () => {
      setupMocks({ cardData: { card: lockedCard } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card frozen")).toBeTruthy()
      expect(getByText("Card is temporarily disabled")).toBeTruthy()
    })
  })

  describe("settings header", () => {
    it("sets headerRight with settings icon via navigation.setOptions", async () => {
      mockSetOptions.mockClear()

      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockSetOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          headerRight: expect.any(Function),
        }),
      )
    })
  })

  describe("action buttons interaction", () => {
    it("navigates to details screen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Details"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardDetailsScreen")
    })

    it("navigates to limits screen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Set limits"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardLimitsScreen")
    })

    it("navigates to statements screen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Statements"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardStatementsScreen")
    })

    it("calls handleFreeze on freeze button press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Freeze"))
      })

      expect(mockHandleFreeze).toHaveBeenCalledWith("card-1", CardStatus.Active)
    })

    it("calls handleFreeze with Locked status for frozen card", async () => {
      setupMocks({ cardData: { card: lockedCard } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Freeze"))
      })

      expect(mockHandleFreeze).toHaveBeenCalledWith("card-1", CardStatus.Locked)
    })

    it("calls console.log on add funds press", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Add funds"))
      })

      expect(consoleSpy).toHaveBeenCalledWith("Add funds pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("error handling", () => {
    it("shows toast on card error", async () => {
      setupMocks({
        cardData: {
          ...defaultCardData,
          error: new Error("Card fetch failed") as ReturnType<
            typeof mockUseCardData
          >["error"],
        },
      })

      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Card fetch failed" }),
      )
    })

    it("shows toast on balance error", async () => {
      setupMocks({
        balance: {
          ...defaultBalance,
          error: new Error("Balance failed") as ReturnType<
            typeof mockUseCardBalance
          >["error"],
        },
      })

      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Balance failed" }),
      )
    })
  })

  describe("scroll pagination", () => {
    it("renders fetchingMore state without crashing", async () => {
      setupMocks({ transactions: { fetchingMore: true } })

      const { toJSON } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("hook calls", () => {
    it("passes card id to useCardBalance", async () => {
      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockUseCardBalance).toHaveBeenCalledWith("card-1")
    })

    it("passes card id to useCardTransactions", async () => {
      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockUseCardTransactions).toHaveBeenCalledWith("card-1")
    })

    it("passes undefined to hooks when no card", async () => {
      setupMocks({ cardData: { card: undefined, loading: false } })

      render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockUseCardBalance).toHaveBeenCalledWith(undefined)
      expect(mockUseCardTransactions).toHaveBeenCalledWith(undefined)
    })
  })

  describe("empty transactions", () => {
    it("shows empty transactions message", async () => {
      setupMocks({ transactions: { transactions: [] } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("No transactions yet")).toBeTruthy()
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections for active card", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("•••• •••• •••• 4242")).toBeTruthy()
      expect(getByText("$100.00")).toBeTruthy()
      expect(getByText("Details")).toBeTruthy()
      expect(getByText("Transactions")).toBeTruthy()
      expect(getByText("Coffee Shop")).toBeTruthy()
    })

    it("navigates to transaction details on press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Coffee Shop"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardTransactionDetailsScreen", {
        transactionId: "tx-1",
      })
    })
  })
})
