import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardApprovedScreen } from "@app/screens/card-screen/onboarding/approved-screen"
import { ContextForScreen } from "../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("@app/components/card-screen", () => {
  const { View, Text, TouchableOpacity } = jest.requireActual("react-native")
  return {
    CardStatusLayout: (props: {
      title: string
      subtitle: string
      buttonLabel: string
      onPrimaryButtonPress: () => void
    }) => (
      <View>
        <Text>{props.title}</Text>
        <Text>{props.subtitle}</Text>
        <TouchableOpacity onPress={props.onPrimaryButtonPress}>
          <Text>{props.buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    ),
  }
})

const mockDispatch = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
    CommonActions: {
      navigate: (screen: string, params?: object) => ({
        type: "NAVIGATE",
        payload: { name: screen, params },
      }),
    },
  }
})

let mockHasPhysicalCard = false
let mockCardLastFour: string | undefined = "1234"

jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => ({
    card: mockCardLastFour ? { id: "card-123", lastFour: mockCardLastFour } : null,
    hasPhysicalCard: mockHasPhysicalCard,
    loading: false,
  }),
}))

describe("CardApprovedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockHasPhysicalCard = false
    mockCardLastFour = "1234"
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("passes correct title to layout", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Congratulations!")).toBeTruthy()
  })

  it("passes correct subtitle to layout", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Your Blink Visa Card has been activated.")).toBeTruthy()
  })

  describe("without physical card", () => {
    it("shows Order physical card button label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Order physical card")).toBeTruthy()
    })

    it("navigates to orderCardScreen on button press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Order physical card"))
      })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "NAVIGATE",
        payload: { name: "orderCardScreen", params: undefined },
      })
    })
  })

  describe("with physical card", () => {
    beforeEach(() => {
      mockHasPhysicalCard = true
    })

    it("shows Dashboard button label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Dashboard")).toBeTruthy()
    })

    it("navigates to cardDashboardScreen on button press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Dashboard"))
      })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "NAVIGATE",
        payload: { name: "cardDashboardScreen", params: undefined },
      })
    })
  })
})
