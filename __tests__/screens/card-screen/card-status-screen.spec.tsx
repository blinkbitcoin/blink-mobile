import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardStatusScreen } from "@app/screens/card-screen/card-status-screen"
import { ContextForScreen } from "../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/utils/helper", () => ({
  isIos: false,
  maskString: (str: string) => str.replace(/\d(?=.{4})/g, "•"),
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

const mockDispatch = jest.fn()
const mockUseRoute = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useRoute: () => mockUseRoute(),
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
    CommonActions: {
      navigate: (screen: string) => ({ type: "NAVIGATE", payload: { name: screen } }),
    },
  }
})

const cardApprovedParams = {
  title: "Congratulations!",
  subtitle: "Your Blink Visa Card has been activated.",
  buttonLabel: "Order physical card",
  navigateTo: "cardDashboardScreen" as const,
  iconName: "approved" as const,
}

const physicalCardOrderedParams = {
  title: "Your physical card is on the way!",
  subtitle: "Order for delivery of your Blink Card has been submitted.",
  buttonLabel: "Create PIN",
  navigateTo: "cardDashboardScreen" as const,
  iconName: "delivery" as const,
}

const cardApprovedWithCustomColorParams = {
  ...cardApprovedParams,
  iconColor: "#FF5500",
}

describe("CardStatusScreen - Card Approved variant", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({
      params: cardApprovedParams,
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays congratulations title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Congratulations!")).toBeTruthy()
  })

  it("displays card activated subtitle", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Your Blink Visa Card has been activated.")).toBeTruthy()
  })

  it("displays order physical card button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Order physical card")).toBeTruthy()
  })

  it("displays the card holder name", async () => {
    const { getAllByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const holderNames = getAllByText("TEST USER")
    expect(holderNames.length).toBeGreaterThanOrEqual(1)
  })

  it("displays the masked card number", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/•••• •••• •••• 1111/)).toBeTruthy()
  })

  it("displays add to wallet button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Add to")).toBeTruthy()
  })

  it("navigates to add to mobile wallet screen when add to wallet pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Add to")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardAddToMobileWalletScreen" },
    })
  })

  it("navigates to correct screen when primary button is pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Order physical card")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardDashboardScreen" },
    })
  })

  it("displays all screen sections", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Congratulations!")).toBeTruthy()
    expect(getByText("Your Blink Visa Card has been activated.")).toBeTruthy()
    expect(getByText("Add to")).toBeTruthy()
    expect(getByText("Order physical card")).toBeTruthy()
  })

  it("add to wallet button has accessibility label", async () => {
    const { getByLabelText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByLabelText("Add to Google Pay")).toBeTruthy()
  })
})

describe("CardStatusScreen - Physical Card Ordered variant", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({
      params: physicalCardOrderedParams,
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays physical card on the way title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Your physical card is on the way!")).toBeTruthy()
  })

  it("displays order submitted subtitle", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText("Order for delivery of your Blink Card has been submitted."),
    ).toBeTruthy()
  })

  it("displays create PIN button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Create PIN")).toBeTruthy()
  })

  it("navigates to correct screen when create PIN button is pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Create PIN")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardDashboardScreen" },
    })
  })
})

describe("CardStatusScreen - custom icon color", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({
      params: cardApprovedWithCustomColorParams,
    })
  })

  it("renders with custom icon color", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })
})

describe("CardStatusScreen - different navigation targets", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("navigates to settings screen when configured", async () => {
    mockUseRoute.mockReturnValue({
      params: {
        ...cardApprovedParams,
        navigateTo: "cardSettingsScreen",
      },
    })

    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Order physical card"))
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardSettingsScreen" },
    })
  })

  it("navigates to limits screen when configured", async () => {
    mockUseRoute.mockReturnValue({
      params: {
        ...cardApprovedParams,
        navigateTo: "cardLimitsScreen",
      },
    })

    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Order physical card"))
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardLimitsScreen" },
    })
  })
})

describe("CardStatusScreen - complete user flow", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({
      params: cardApprovedParams,
    })
  })

  it("user can interact with add to wallet button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Add to"))
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardAddToMobileWalletScreen" },
    })
  })

  it("user can interact with primary action button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Order physical card"))
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "cardDashboardScreen" },
    })
  })

  it("both buttons can be pressed in sequence", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Add to"))
    })

    await act(async () => {
      fireEvent.press(getByText("Order physical card"))
    })

    expect(mockDispatch).toHaveBeenCalledTimes(2)
  })
})

describe("CardStatusScreen - BlinkCard component", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({
      params: cardApprovedParams,
    })
  })

  it("renders BlinkCard with correct props", async () => {
    const { getAllByText, getByText } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const holderNames = getAllByText("TEST USER")
    expect(holderNames.length).toBeGreaterThanOrEqual(1)
    expect(getByText(/•••• •••• •••• 1111/)).toBeTruthy()
  })

  it("displays card in non-frozen state", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardStatusScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })
})
