import React from "react"
import { Text, View } from "react-native"
import { render } from "@testing-library/react-native"

import { QRCarousel } from "@app/components/qr-carousel"

/** Mocked at the module the index re-exports: spreading `react-native` itself pulls in the
 *  whole index eagerly and the dev-menu TurboModule throws under jest. */
const mockWindow = { width: 360, height: 800, scale: 2, fontScale: 1 }
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}))

/** What the carousel was asked to be, so a test can read the size back. */
const mockCarouselProps: { width?: number; height?: number } = {}

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

  const Carousel = React.forwardRef((props: CarouselProps, _ref: React.Ref<never>) => {
    mockCarouselProps.width = props.width
    mockCarouselProps.height = props.height
    return (
      <RNView testID="carousel">
        {props.data.map((_, index: number) => (
          <RNView key={index} testID={`carousel-item-${index}`}>
            {props.renderItem({ index, animationValue: { value: 0 } })}
          </RNView>
        ))}
      </RNView>
    )
  })
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
    mockWindow.width = 360
    mockWindow.height = 800
  })

  /** The page holding the code is square, so the window's shorter edge bounds it. Taking
   *  the width instead overflowed the viewport once the screen could rotate. */
  describe("sizing against the window", () => {
    const renderedHeight = (): number | undefined => {
      render(<QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />)
      return mockCarouselProps.height
    }

    it("keeps the portrait height in landscape rather than following the long edge", () => {
      const portrait = renderedHeight()

      mockWindow.width = 800
      mockWindow.height = 360

      expect(renderedHeight()).toBe(portrait)
    })

    it("stays within the shorter edge in landscape", () => {
      mockWindow.width = 800
      mockWindow.height = 360

      expect(renderedHeight()).toBeLessThanOrEqual(360)
    })

    it("still spans the full width for paging", () => {
      mockWindow.width = 800
      mockWindow.height = 360
      render(<QRCarousel page0={page0} page1={page1} onSnap={mockOnSnap} />)

      expect(mockCarouselProps.width).toBe(800)
    })
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
