import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardShippingAddressScreen } from "@app/screens/card-screen/card-shipping-address-screen"
import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}))

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_SHIPPING_ADDRESS: {
    fullName: "Joe Nakamoto",
    addressLine1: "Address line 1",
    addressLine2: "Address line 2",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "USA",
  },
  US_STATES: [
    { value: "NY", label: "New York" },
    { value: "CA", label: "California" },
  ],
  COUNTRIES: [
    { value: "USA", label: "United States" },
    { value: "CAN", label: "Canada" },
  ],
}))

describe("CardShippingAddressScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockNavigate.mockClear()
    mockGoBack.mockClear()
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays full name field", async () => {
      const { getByText, getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Full name")).toBeTruthy()
      expect(getByDisplayValue("Joe Nakamoto")).toBeTruthy()
    })

    it("displays address line 1 field", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("Address line 1").length).toBeGreaterThanOrEqual(1)
    })

    it("displays address line 2 field", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("Address line 2").length).toBeGreaterThanOrEqual(1)
    })

    it("displays city field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("City")).toBeTruthy()
      expect(getByText("New York")).toBeTruthy()
    })

    it("displays state field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("State")).toBeTruthy()
      expect(getByText("NY")).toBeTruthy()
    })

    it("displays postal code field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Postal code")).toBeTruthy()
      expect(getByText("10001")).toBeTruthy()
    })

    it("displays country field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Country")).toBeTruthy()
      expect(getByText("USA")).toBeTruthy()
    })
  })

  describe("info card section", () => {
    it("displays important info card", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Important")).toBeTruthy()
    })

    it("displays important description", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText("Please ensure your address is accurate and complete."),
      ).toBeTruthy()
    })

    it("displays no P.O. boxes bullet", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Cards cannot be delivered to P.O. boxes")).toBeTruthy()
    })

    it("displays signature required bullet", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Signature may be required upon delivery")).toBeTruthy()
    })

    it("displays supported regions bullet", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Address must be within supported shipping regions")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("renders editable full name field", async () => {
      const { getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByDisplayValue("Joe Nakamoto")).toBeTruthy()
    })

    it("navigates to selection screen for state field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const stateValue = getByText("NY")
      await act(async () => {
        fireEvent.press(stateValue)
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        "selectionScreen",
        expect.objectContaining({
          title: "State",
          selectedValue: "NY",
        }),
      )
    })

    it("navigates to selection screen for country field", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const countryValue = getByText("USA")
      await act(async () => {
        fireEvent.press(countryValue)
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        "selectionScreen",
        expect.objectContaining({
          title: "Country",
          selectedValue: "USA",
        }),
      )
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Full name")).toBeTruthy()
      expect(getByText("City")).toBeTruthy()
      expect(getByText("State")).toBeTruthy()
      expect(getByText("Postal code")).toBeTruthy()
      expect(getByText("Country")).toBeTruthy()
      expect(getByText("Important")).toBeTruthy()
    })
  })
})
