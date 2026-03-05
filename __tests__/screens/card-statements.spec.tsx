import React from "react"
import { View } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardStatementsScreen } from "@app/screens/card-screen/card-statements-screen"
import { ContextForScreen } from "./helper"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View,
    createAnimatedComponent: (component: React.ComponentType) => component,
  },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  interpolateColor: () => "transparent",
}))

jest.mock("react-native-modal", () => "Modal")

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feedbackEmailAddress: "support@test.com",
  }),
}))

jest.mock("@app/screens/card-screen/card-statements-mock-data", () => ({
  MOCK_STATEMENTS: [
    {
      id: "1",
      month: "August",
      year: 2025,
      period: "Aug 1 - Aug 30",
      transactionCount: 0,
      totalSpent: "$1,021.00",
      isCurrent: true,
      isDownloaded: false,
    },
    {
      id: "2",
      month: "July",
      year: 2025,
      period: "Jul 1 - Jul 30, 2025",
      transactionCount: 5,
      totalSpent: "$121.00",
      isCurrent: false,
      isDownloaded: true,
    },
    {
      id: "3",
      month: "June",
      year: 2025,
      period: "Jun 1 - Jun 30, 2025",
      transactionCount: 5,
      totalSpent: "$121.00",
      isCurrent: false,
      isDownloaded: true,
    },
  ],
  MOCK_YEAR_OPTIONS: [
    { year: 2025, itemCount: 3 },
    { year: 2024, itemCount: 0, disabled: true },
    { year: 2023, itemCount: 0, disabled: true },
  ],
  DEFAULT_YEAR: 2025,
}))

describe("CardStatementsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays year selector section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Select year")).toBeTruthy()
    })

    it("displays selected year", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const yearTexts = getAllByText("2025")
      expect(yearTexts.length).toBeGreaterThan(0)
    })

    it("displays current statement section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Current statement")).toBeTruthy()
    })

    it("displays statement period label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Statement period")).toBeTruthy()
    })

    it("displays total spent label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Total spent")).toBeTruthy()
    })

    it("displays current statement period value", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Aug 1 - Aug 30")).toBeTruthy()
    })

    it("displays current statement total spent value", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$1,021.00")).toBeTruthy()
    })

    it("displays monthly statements section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Monthly statements")).toBeTruthy()
    })

    it("displays download all button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Download all")).toBeTruthy()
    })

    it("displays statement items", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("August 2025")).toBeTruthy()
      expect(getByText("July 2025")).toBeTruthy()
      expect(getByText("June 2025")).toBeTruthy()
    })

    it("displays about statements section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("About statements")).toBeTruthy()
    })

    it("displays notifications section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Notifications")).toBeTruthy()
    })

    it("displays notification toggle text", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Notify me when new statements are made available")).toBeTruthy()
    })

    it("displays support section", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Support")).toBeTruthy()
    })

    it("displays contact support text", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact Support")).toBeTruthy()
    })

    it("displays support email from remote config", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("support@test.com")).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("allows pressing download all button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const downloadAllButton = getByText("Download all")
      await act(async () => {
        fireEvent.press(downloadAllButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Download all statements")
      consoleSpy.mockRestore()
    })

    it("allows pressing contact support button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const contactSupportButton = getByText("Contact Support")
      await act(async () => {
        fireEvent.press(contactSupportButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Contact support")
      consoleSpy.mockRestore()
    })

    it("allows toggling notifications switch", async () => {
      const { getByRole } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const switchElement = getByRole("switch")
      expect(switchElement).toBeTruthy()

      await act(async () => {
        fireEvent(switchElement, "pressIn")
      })
    })
  })

  describe("statement items", () => {
    it("displays current statement with spent amount", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("August 2025")).toBeTruthy()
      expect(getByText("$1,021.00 spent")).toBeTruthy()
    })

    it("displays past statements with period and transactions", async () => {
      const { getByText, getAllByText } = render(
        <ContextForScreen>
          <CardStatementsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("July 2025")).toBeTruthy()
      expect(getByText("Jul 1 - Jul 30, 2025")).toBeTruthy()
      const transactionTexts = getAllByText("5 transactions, $121.00 spent")
      expect(transactionTexts.length).toBeGreaterThanOrEqual(1)
    })
  })
})
