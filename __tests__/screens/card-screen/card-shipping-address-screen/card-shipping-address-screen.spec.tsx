import React from "react"
import { Alert } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardShippingAddressScreen } from "@app/screens/card-screen/card-shipping-address-screen"
import { ContextForScreen } from "../../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockDispatch = jest.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAddListener = jest.fn((_event: string, _callback: any) => jest.fn())

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    dispatch: mockDispatch,
    addListener: mockAddListener,
  }),
}))

jest.spyOn(Alert, "alert")

const mockUseShippingAddressData = jest.fn()
jest.mock("@app/screens/card-screen/card-shipping-address-screen/hooks", () => ({
  useShippingAddressData: () => mockUseShippingAddressData(),
}))

jest.mock("@app/screens/card-screen/country-region-data", () => ({
  COUNTRIES: [
    { value: "USA", label: "United States" },
    { value: "CAN", label: "Canada" },
  ],
  getRegionsByCountry: (code: string) => {
    if (code === "USA")
      return [
        { value: "NY", label: "New York" },
        { value: "CA", label: "California" },
      ]
    if (code === "CAN")
      return [
        { value: "ON", label: "Ontario" },
        { value: "BC", label: "British Columbia" },
      ]
    return []
  },
  getIsoAlpha2: (code: string) => {
    if (code === "USA") return "US"
    if (code === "CAN") return "CA"
    return undefined
  },
}))

const mockAddress = {
  firstName: "Joe",
  lastName: "Nakamoto",
  line1: "Address line 1",
  line2: "Address line 2",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "USA",
}

describe("CardShippingAddressScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseShippingAddressData.mockReturnValue({
      initialAddress: mockAddress,
      loading: false,
    })
  })

  describe("loading state", () => {
    it("shows activity indicator while loading", async () => {
      mockUseShippingAddressData.mockReturnValue({
        initialAddress: null,
        loading: true,
      })

      const { getByTestId } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("activity-indicator")).toBeTruthy()
    })

    it("does not show form while loading", async () => {
      mockUseShippingAddressData.mockReturnValue({
        initialAddress: null,
        loading: true,
      })

      const { queryByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Important")).toBeNull()
    })
  })

  describe("empty state", () => {
    it("renders empty form when no shipping address exists", async () => {
      mockUseShippingAddressData.mockReturnValue({
        initialAddress: null,
        loading: false,
      })

      const { getByText } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Important")).toBeTruthy()
    })
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

    it("displays first name field", async () => {
      const { getByText, getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("First name")).toBeTruthy()
      expect(getByDisplayValue("Joe")).toBeTruthy()
    })

    it("displays last name field", async () => {
      const { getByText, getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Last name")).toBeTruthy()
      expect(getByDisplayValue("Nakamoto")).toBeTruthy()
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
      const { getByText, getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("City")).toBeTruthy()
      expect(getByDisplayValue("New York")).toBeTruthy()
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
      const { getByText, getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Postal code")).toBeTruthy()
      expect(getByDisplayValue("10001")).toBeTruthy()
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
    it("renders editable name fields", async () => {
      const { getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByDisplayValue("Joe")).toBeTruthy()
      expect(getByDisplayValue("Nakamoto")).toBeTruthy()
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

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("City")).toBeTruthy()
      expect(getByText("State")).toBeTruthy()
      expect(getByText("Postal code")).toBeTruthy()
      expect(getByText("Country")).toBeTruthy()
      expect(getByText("Important")).toBeTruthy()
    })
  })

  describe("discard changes", () => {
    it("registers beforeRemove listener on mount", async () => {
      render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("does not show alert when navigating back without changes", async () => {
      render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const beforeRemoveCalls = mockAddListener.mock.calls.filter(
        (call) => call[0] === "beforeRemove",
      )
      const beforeRemoveCallback = beforeRemoveCalls[beforeRemoveCalls.length - 1]![1]

      const mockEvent = { data: { action: { type: "GO_BACK" } }, preventDefault: jest.fn() }
      beforeRemoveCallback(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    it("shows discard alert when navigating back with unsaved changes", async () => {
      const { getByDisplayValue } = render(
        <ContextForScreen>
          <CardShippingAddressScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.changeText(getByDisplayValue("Joe"), "Jane")
      })

      const beforeRemoveCalls = mockAddListener.mock.calls.filter(
        (call) => call[0] === "beforeRemove",
      )
      const beforeRemoveCallback = beforeRemoveCalls[beforeRemoveCalls.length - 1]![1]

      const mockEvent = { data: { action: { type: "GO_BACK" } }, preventDefault: jest.fn() }
      beforeRemoveCallback(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith(
        "Warning",
        "You have unsaved changes. Are you sure you want to discard them?",
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancel" }),
          expect.objectContaining({ text: "Discard" }),
        ]),
      )
    })
  })
})
