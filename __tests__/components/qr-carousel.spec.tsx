import React from "react"
import { Text, View } from "react-native"
import { render } from "@testing-library/react-native"

import { QRCarousel } from "@app/components/qr-carousel"

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({
    page: {},
    overlay: {},
  }),
}))

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View },
  interpolate: jest.fn(() => 0),
  useAnimatedStyle: () => ({}),
}))

jest.mock("react-native-reanimated-carousel", () => {
  const { View: RNView } = jest.requireActual("react-native")
  const React = jest.requireActual("react")

  type CarouselProps = {
    data: number[]
    renderItem: (info: {
      index: number
      animationValue: { value: number }
    }) => React.ReactElement
    onSnapToItem: (index: number) => void
    width: number
    height: number
  }

  const Carousel = React.forwardRef((props: CarouselProps, _ref: React.Ref<never>) => (
    <RNView testID="carousel">
      {props.data.map((_, index: number) => (
        <RNView key={index} testID={`carousel-item-${index}`}>
          {props.renderItem({ index, animationValue: { value: 0 } })}
        </RNView>
      ))}
    </RNView>
  ))
  Carousel.displayName = "MockCarousel"

  return {
    __esModule: true,
    default: Carousel,
  }
})

describe("QRCarousel", () => {
  const mockOnSnap = jest.fn()

  const page0 = (
    <View testID="page-0">
      <Text>Lightning QR</Text>
    </View>
  )

  const page1 = (
    <View testID="page-1">
      <Text>OnChain QR</Text>
    </View>
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without crashing", () => {
    const { toJSON } = render(
      <QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />,
    )

    expect(toJSON()).toBeTruthy()
  })

  it("renders both pages", () => {
    const { getByText } = render(
      <QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />,
    )

    expect(getByText("Lightning QR")).toBeTruthy()
    expect(getByText("OnChain QR")).toBeTruthy()
  })

  it("renders the carousel container", () => {
    const { getByTestId } = render(
      <QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />,
    )

    expect(getByTestId("carousel")).toBeTruthy()
  })

  it("renders two carousel items", () => {
    const { getByTestId } = render(
      <QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />,
    )

    expect(getByTestId("carousel-item-0")).toBeTruthy()
    expect(getByTestId("carousel-item-1")).toBeTruthy()
  })
})
