import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDetailsScreen } from "@app/screens/card-screen/card-details-screen"
import { ContextForScreen } from "../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      setOptions: mockSetOptions,
    }),
  }
})

const mockCopyToClipboard = jest.fn()

jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
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

describe("CardDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockCopyToClipboard.mockClear()
    mockSetOptions.mockClear()
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays the card holder name", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const holderNames = getAllByText("TEST USER")
      expect(holderNames.length).toBeGreaterThanOrEqual(1)
    })

    it("displays the card number field", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const cardNumbers = getAllByText("4111 1111 1111 1111")
      expect(cardNumbers.length).toBeGreaterThanOrEqual(1)
    })

    it("displays the expiry date field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("06/29")).toBeTruthy()
    })

    it("displays the CVV field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("123")).toBeTruthy()
    })

    it("displays the cardholder name field", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const holderNames = getAllByText("TEST USER")
      expect(holderNames.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("card information section", () => {
    it("displays card information title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card information")).toBeTruthy()
    })

    it("displays card type", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Virtual Visa debit")).toBeTruthy()
    })

    it("displays status as active", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Active")).toBeTruthy()
    })

    it("displays issued date", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Jan 15, 2024")).toBeTruthy()
    })

    it("displays network", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Visa")).toBeTruthy()
    })
  })

  describe("warning section", () => {
    it("displays keep details safe warning", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Keep your details safe")).toBeTruthy()
    })

    it("displays security warning text", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Never share your card details with anyone. Blink will never ask for your card information via email or phone.",
        ),
      ).toBeTruthy()
    })
  })

  describe("copy interactions", () => {
    it("calls copyToClipboard when card number field is pressed", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("card-number-field"))
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "4111111111111111",
        }),
      )
    })

    it("calls copyToClipboard when expiry date field is pressed", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const expiryDate = getByText("06/29")
      await act(async () => {
        fireEvent.press(expiryDate)
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "06/29",
        }),
      )
    })

    it("calls copyToClipboard when CVV field is pressed", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const cvv = getByText("123")
      await act(async () => {
        fireEvent.press(cvv)
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "123",
        }),
      )
    })
  })

  describe("field labels", () => {
    it("displays card number label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card number")).toBeTruthy()
    })

    it("displays expiry date label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Expiry date")).toBeTruthy()
    })

    it("displays CVV label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("CVV")).toBeTruthy()
    })

    it("displays cardholder name label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Cardholder name")).toBeTruthy()
    })
  })

  describe("info row labels", () => {
    it("displays card type label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card type")).toBeTruthy()
    })

    it("displays status label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Status")).toBeTruthy()
    })

    it("displays issued label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Issued")).toBeTruthy()
    })

    it("displays network label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Network")).toBeTruthy()
    })
  })

  describe("header settings button", () => {
    it("sets headerRight option on mount", async () => {
      render(
        <ContextForScreen>
          <CardDetailsScreen />
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
})
