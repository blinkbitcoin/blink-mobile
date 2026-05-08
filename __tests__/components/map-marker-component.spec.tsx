import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import MapMarkerComponent from "@app/components/map-marker-component"

jest.mock("react-native-maps", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return {
    Marker: (props: { children?: React.ReactNode; onPress?: () => void }) =>
      ReactActual.createElement(
        RN.View,
        { testID: "marker", onPress: props.onPress },
        props.children,
      ),
    Callout: (props: { children?: React.ReactNode; onPress?: () => void }) =>
      ReactActual.createElement(
        RN.View,
        { testID: "callout", onPress: props.onPress },
        props.children,
      ),
    CalloutSubview: (props: { children?: React.ReactNode; onPress?: () => void }) =>
      ReactActual.createElement(
        RN.View,
        { testID: "callout-subview", onPress: props.onPress },
        props.children,
      ),
    MapMarker: jest.fn(),
  }
})

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      MapScreen: {
        payBusiness: () => "Pay this business",
      },
    },
  }),
}))

const mockHelper = { isIos: false }
jest.mock("@app/utils/helper", () => ({
  get isIos() {
    return mockHelper.isIos
  },
}))

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return {
    Text: (props: { children?: React.ReactNode } & Record<string, unknown>) =>
      ReactActual.createElement(RN.Text, props, props.children),
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({
          colors: {
            grey4: "#cccccc",
            white: "#ffffff",
            black: "#000000",
            primary3: "#fc5805",
          },
        }),
  }
})

const baseItem = {
  __typename: "MapMarker" as const,
  username: "isacorlando",
  mapInfo: {
    __typename: "MapInfo" as const,
    title: "Isac Orlando Bakery",
    coordinates: {
      __typename: "Coordinates" as const,
      latitude: 13.4924,
      longitude: -89.4395,
    },
  },
}

describe("MapMarkerComponent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHelper.isIos = false
  })

  it("always renders the callout content (title + pay button) so the native InfoWindow snapshot has it from creation", () => {
    const { getByText } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={jest.fn()}
      />,
    )

    expect(getByText("Isac Orlando Bakery")).toBeTruthy()
    expect(getByText("Pay this business")).toBeTruthy()
  })

  it("renders content unconditionally without an isFocused prop (regression for the lazy-render Fabric bug)", () => {
    const { getByText, queryByText } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={jest.fn()}
      />,
    )

    expect(getByText(baseItem.mapInfo.title)).toBeTruthy()
    expect(queryByText("Pay this business")).not.toBeNull()
  })

  it("calls handleMarkerPress with the item when the marker is pressed (Android: ref undefined)", () => {
    const handleMarkerPress = jest.fn()

    const { getByTestId } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={handleMarkerPress}
        handleCalloutPress={jest.fn()}
      />,
    )

    fireEvent.press(getByTestId("marker"))
    expect(handleMarkerPress).toHaveBeenCalledTimes(1)
    expect(handleMarkerPress).toHaveBeenCalledWith(baseItem, undefined)
  })

  it("calls handleCalloutPress when the callout is pressed", () => {
    const handleCalloutPress = jest.fn()

    const { getByTestId } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={handleCalloutPress}
      />,
    )

    fireEvent.press(getByTestId("callout"))
    expect(handleCalloutPress).toHaveBeenCalledWith(baseItem)
  })

  it("renders CalloutSubview around the pay button only on iOS", () => {
    mockHelper.isIos = true

    const { getByTestId } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={jest.fn()}
      />,
    )

    expect(getByTestId("callout-subview")).toBeTruthy()
  })

  it("does not render CalloutSubview on Android (regular View instead)", () => {
    mockHelper.isIos = false

    const { queryByTestId } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={jest.fn()}
      />,
    )

    expect(queryByTestId("callout-subview")).toBeNull()
  })

  it("calls handleCalloutPress from the iOS CalloutSubview pay button", () => {
    mockHelper.isIos = true
    const handleCalloutPress = jest.fn()

    const { getByTestId } = render(
      <MapMarkerComponent
        item={baseItem}
        color="#orange"
        handleMarkerPress={jest.fn()}
        handleCalloutPress={handleCalloutPress}
      />,
    )

    fireEvent.press(getByTestId("callout-subview"))
    expect(handleCalloutPress).toHaveBeenCalledWith(baseItem)
  })
})
