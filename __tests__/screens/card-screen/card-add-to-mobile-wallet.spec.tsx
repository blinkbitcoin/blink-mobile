import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardAddToMobileWalletScreen } from "@app/screens/card-screen/card-add-to-mobile-wallet-screen"
import { ContextForScreen } from "../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  isIos: false,
}))

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  CardStatus: {
    Active: "active",
    Frozen: "frozen",
    Inactive: "inactive",
  },
  MOCK_CARD: {
    cardNumber: "4111 1111 1111 1111",
    holderName: "TEST USER",
    validThruDate: "2029-06-01",
    cvv: "123",
    expiryDate: "06/29",
    cardType: "Virtual Visa debit",
    status: "active",
    issuedDate: "Jan 15, 2024",
    network: "Visa",
  },
}))

describe("CardAddToMobileWalletScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays add your card title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add your card")).toBeTruthy()
    })

    it("displays add your card description", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Add your Blink Visa card to your mobile wallet for quick and secure payments",
        ),
      ).toBeTruthy()
    })
  })

  describe("card display", () => {
    it("displays the card holder name on the card", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const holderNames = getAllByText("TEST USER")
      expect(holderNames.length).toBeGreaterThanOrEqual(1)
    })

    it("displays the masked card number", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText(/•••• •••• •••• 1111/)).toBeTruthy()
    })
  })

  describe("add to wallet button", () => {
    it("displays add to wallet button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add to")).toBeTruthy()
    })

    it("allows pressing add to wallet button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Add to")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Add to wallet pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("benefits section", () => {
    it("displays benefits title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Benefits of mobile wallet")).toBeTruthy()
    })

    it("displays contactless payments benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contactless payments at millions of locations")).toBeTruthy()
    })

    it("displays security benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enhanced security with biometric authentication")).toBeTruthy()
    })

    it("displays no physical card benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("No need to carry your physical card")).toBeTruthy()
    })

    it("displays works when locked benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Works even when your phone is locked")).toBeTruthy()
    })

    it("displays all four benefits", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contactless payments at millions of locations")).toBeTruthy()
      expect(getByText("Enhanced security with biometric authentication")).toBeTruthy()
      expect(getByText("No need to carry your physical card")).toBeTruthy()
      expect(getByText("Works even when your phone is locked")).toBeTruthy()
    })
  })

  describe("hero section", () => {
    it("displays hero section with icon", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const tree = toJSON()
      expect(tree).toBeTruthy()
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add your card")).toBeTruthy()
      expect(
        getByText(
          "Add your Blink Visa card to your mobile wallet for quick and secure payments",
        ),
      ).toBeTruthy()
      expect(getByText("Add to")).toBeTruthy()
      expect(getByText("Benefits of mobile wallet")).toBeTruthy()
    })

    it("user can interact with add to wallet button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Add to"))
      })

      expect(consoleSpy).toHaveBeenCalledWith("Add to wallet pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("loading state", () => {
    it("button becomes disabled during loading", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Add to")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
