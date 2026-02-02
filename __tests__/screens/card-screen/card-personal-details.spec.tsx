import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardPersonalDetailsScreen } from "@app/screens/card-screen/card-personal-details-screen"
import { ContextForScreen } from "../helper"

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feedbackEmailAddress: "support@blink.sv",
  }),
}))

describe("CardPersonalDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays user full name in header", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const nameElements = getAllByText("Satoshi Nakamoto")
      expect(nameElements.length).toBeGreaterThanOrEqual(1)
    })

    it("displays cardholder label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Blink Visa Cardholder")).toBeTruthy()
    })
  })

  describe("kyc information section", () => {
    it("displays kyc verified information card", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("KYC verified information")).toBeTruthy()
    })

    it("displays kyc verified description", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Your name, date of birth and address are verified through our KYC process. You can change the information by redoing the KYC process. We don't guarantee an approval.",
        ),
      ).toBeTruthy()
    })

    it("displays change kyc information button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Change KYC information")).toBeTruthy()
    })
  })

  describe("personal information fields", () => {
    it("displays first name field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Joe")).toBeTruthy()
    })

    it("displays last name field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("Nakamoto")).toBeTruthy()
    })

    it("displays date of birth field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Date of birth")).toBeTruthy()
      expect(getByText("1971-01-03")).toBeTruthy()
    })
  })

  describe("contact information section", () => {
    it("displays contact information section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact information")).toBeTruthy()
    })

    it("displays email", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("email@gmail.com")).toBeTruthy()
    })

    it("displays phone number", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("+1 (555) 123-4567")).toBeTruthy()
    })
  })

  describe("address sections", () => {
    it("displays registered address section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Registered address")).toBeTruthy()
    })

    it("displays registered address", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("Apt 4B")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
    })

    it("displays shipping address section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Shipping address")).toBeTruthy()
    })

    it("displays shipping address", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("13 Hash Street")).toBeTruthy()
      expect(getByText("Apt 21C")).toBeTruthy()
      expect(getByText("Austin, TX 10001")).toBeTruthy()
    })
  })

  describe("support section", () => {
    it("displays support section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Support")).toBeTruthy()
    })

    it("displays contact support row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact Support")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("allows pressing change kyc information button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Change KYC information")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Change KYC information pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing edit shipping address", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByLabelText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const shippingAddress = getByLabelText(
        "Satoshi Nakamoto, 13 Hash Street, Apt 21C, Austin, TX 10001, United States",
      )
      await act(async () => {
        fireEvent.press(shippingAddress)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Edit shipping address pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing contact support", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const contactSupport = getByText("Contact Support")
      await act(async () => {
        fireEvent.press(contactSupport)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Contact support pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections", async () => {
      const { getByText, getAllByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("Satoshi Nakamoto").length).toBeGreaterThanOrEqual(1)
      expect(getByText("Blink Visa Cardholder")).toBeTruthy()
      expect(getByText("KYC verified information")).toBeTruthy()
      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("Date of birth")).toBeTruthy()
      expect(getByText("Contact information")).toBeTruthy()
      expect(getByText("Registered address")).toBeTruthy()
      expect(getByText("Shipping address")).toBeTruthy()
      expect(getByText("Support")).toBeTruthy()
    })

    it("user can interact with all interactive elements", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText, getByLabelText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Change KYC information"))
      })

      await act(async () => {
        fireEvent.press(
          getByLabelText(
            "Satoshi Nakamoto, 13 Hash Street, Apt 21C, Austin, TX 10001, United States",
          ),
        )
      })

      await act(async () => {
        fireEvent.press(getByText("Contact Support"))
      })

      expect(consoleSpy).toHaveBeenCalledWith("Change KYC information pressed")
      expect(consoleSpy).toHaveBeenCalledWith("Edit shipping address pressed")
      expect(consoleSpy).toHaveBeenCalledWith("Contact support pressed")

      consoleSpy.mockRestore()
    })
  })
})
