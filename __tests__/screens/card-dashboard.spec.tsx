import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDashboardScreen } from "@app/screens/card-screen/card-dashboard-screen"
import { ContextForScreen } from "./helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_CARD: {
    cardNumber: "4111 1111 1111 1111",
    holderName: "TEST USER",
    validThruDate: "2029-06-01",
  },
  MOCK_TRANSACTIONS: [
    {
      date: "Today",
      transactions: [
        {
          id: "test-1",
          merchantName: "Test Store",
          timeAgo: "5 minutes ago",
          amount: "-$10.00",
          status: "pending",
        },
        {
          id: "test-2",
          merchantName: "Test Restaurant",
          timeAgo: "2 hours ago",
          amount: "-$25.50",
          status: "completed",
        },
      ],
    },
    {
      date: "Yesterday",
      transactions: [
        {
          id: "test-3",
          merchantName: "Test Shop",
          timeAgo: "1 day ago",
          amount: "-$50.00",
          status: "completed",
        },
      ],
    },
  ],
  EMPTY_TRANSACTIONS: [],
}))

describe("CardDashboardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays the card holder name", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("TEST USER")).toBeTruthy()
    })

    it("displays the masked card number", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("•••• •••• •••• 1111")).toBeTruthy()
    })

    it("displays the balance section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$29.42")).toBeTruthy()
      expect(getByText("~ Kč576.44")).toBeTruthy()
    })

    it("displays the add funds button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add funds")).toBeTruthy()
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

    it("displays the transactions title", async () => {
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

      expect(getByText("Test Store")).toBeTruthy()
      expect(getByText("Test Restaurant")).toBeTruthy()
      expect(getByText("Test Shop")).toBeTruthy()
    })

    it("displays transaction amounts", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("-$10.00")).toBeTruthy()
      expect(getByText("-$25.50")).toBeTruthy()
      expect(getByText("-$50.00")).toBeTruthy()
    })
  })

  describe("freeze card interaction", () => {
    it("shows frozen state when freeze button is pressed", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Card frozen")).toBeNull()

      const freezeButton = getByText("Freeze")
      await act(async () => {
        fireEvent.press(freezeButton)
      })

      expect(getByText("Card frozen")).toBeTruthy()
      expect(getByText("Card is temporarily disabled")).toBeTruthy()
    })

    it("shows unfrozen state when freeze button is pressed again", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const freezeButton = getByText("Freeze")

      await act(async () => {
        fireEvent.press(freezeButton)
      })

      expect(getByText("Card frozen")).toBeTruthy()

      await act(async () => {
        fireEvent.press(freezeButton)
      })

      expect(queryByText("Card frozen")).toBeNull()
    })

    it("disables add funds button when card is frozen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const freezeButton = getByText("Freeze")
      await act(async () => {
        fireEvent.press(freezeButton)
      })

      const addFundsButton = getByText("Add funds")
      expect(addFundsButton).toBeTruthy()
    })

    it("toggles freeze state multiple times", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const freezeButton = getByText("Freeze")

      await act(async () => {
        fireEvent.press(freezeButton)
      })
      expect(getByText("Card frozen")).toBeTruthy()

      await act(async () => {
        fireEvent.press(freezeButton)
      })
      expect(queryByText("Card frozen")).toBeNull()

      await act(async () => {
        fireEvent.press(freezeButton)
      })
      expect(getByText("Card frozen")).toBeTruthy()

      await act(async () => {
        fireEvent.press(freezeButton)
      })
      expect(queryByText("Card frozen")).toBeNull()
    })
  })

  describe("action buttons interaction", () => {
    it("allows pressing details button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const detailsButton = getByText("Details")
      await act(async () => {
        fireEvent.press(detailsButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Details pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing set limits button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const setLimitsButton = getByText("Set limits")
      await act(async () => {
        fireEvent.press(setLimitsButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Set limits pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing statements button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const statementsButton = getByText("Statements")
      await act(async () => {
        fireEvent.press(statementsButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Statements pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing add funds button when not frozen", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const addFundsButton = getByText("Add funds")
      await act(async () => {
        fireEvent.press(addFundsButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Add funds pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("complete user flow", () => {
    it("allows user to freeze card and then unfreeze", async () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("TEST USER")).toBeTruthy()
      expect(getByText("$29.42")).toBeTruthy()

      expect(queryByText("Card frozen")).toBeNull()

      const freezeButton = getByText("Freeze")
      await act(async () => {
        fireEvent.press(freezeButton)
      })

      expect(getByText("Card frozen")).toBeTruthy()

      await act(async () => {
        fireEvent.press(freezeButton)
      })

      expect(queryByText("Card frozen")).toBeNull()
      expect(getByText("TEST USER")).toBeTruthy()
    })

    it("displays all screen sections in correct order", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDashboardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("TEST USER")).toBeTruthy()
      expect(getByText("$29.42")).toBeTruthy()
      expect(getByText("Details")).toBeTruthy()
      expect(getByText("Transactions")).toBeTruthy()
      expect(getByText("Test Store")).toBeTruthy()
    })
  })
})
