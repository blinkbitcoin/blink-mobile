import React from "react"
import { act, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { Confetti } from "@app/components/confetti"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"

type CannonProps = {
  colors: string[]
  gravity: number
  autoplay: boolean
  fadeOutOnEnd: boolean
  reduceMotion: unknown
  onAnimationEnd: () => void
  children: React.ReactNode
}

const mockCannonProps = jest.fn()
const mockOriginProps = jest.fn()

jest.mock("react-native-fast-confetti", () => {
  const { View } = jest.requireActual("react-native")
  const MockOrigin = (props: { children: React.ReactNode }) => {
    mockOriginProps(props)
    return <View testID="cannon-origin">{props.children}</View>
  }
  const MockFlake = () => <View testID="cannon-flake" />
  const MockCannon = (props: CannonProps) => {
    mockCannonProps(props)
    return <View testID="cannon">{props.children}</View>
  }
  return {
    CannonConfetti: Object.assign(MockCannon, { Origin: MockOrigin, Flake: MockFlake }),
  }
})

const renderConfetti = (props: React.ComponentProps<typeof Confetti> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <Confetti {...props} />
    </ThemeProvider>,
  )

const lastCannonProps = (): CannonProps => mockCannonProps.mock.calls.at(-1)[0]

describe("Confetti", () => {
  beforeEach(() => {
    mockCannonProps.mockClear()
    mockOriginProps.mockClear()
  })

  it("fires one cannon from the bottom center with the default burst", () => {
    renderConfetti()

    expect(mockOriginProps).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "bottom-center",
        count: 150,
        initialSpeed: 1.9,
        spread: Math.PI / 1.6,
      }),
    )
    expect(lastCannonProps()).toMatchObject({
      autoplay: true,
      fadeOutOnEnd: true,
      gravity: 1.2,
    })
  })

  it("paints the pieces in the theme's celebration colors by default", () => {
    renderConfetti()

    expect(lastCannonProps().colors).toEqual([
      light._green,
      light.primary,
      light._orange,
      light.red,
      light._blue,
      light._sky,
    ])
  })

  it("takes the count, speed, gravity and colors it is given", () => {
    renderConfetti({
      count: 30,
      speed: 1.5,
      gravity: 2,
      colors: ["#111111", "#222222"],
    })

    expect(mockOriginProps).toHaveBeenCalledWith(
      expect.objectContaining({ count: 30, initialSpeed: 1.5 }),
    )
    expect(lastCannonProps()).toMatchObject({
      gravity: 2,
      colors: ["#111111", "#222222"],
    })
  })

  it("throws pieces of three shapes", () => {
    const { getAllByTestId } = renderConfetti()

    expect(getAllByTestId("cannon-flake")).toHaveLength(3)
  })

  /** The library would only scale the burst down; the app turns it off. */
  it("stays off entirely when the system asks to reduce motion", () => {
    renderConfetti()

    expect(lastCannonProps().reduceMotion).toEqual({ mode: "system", factor: 1 })
  })

  it("never takes a touch", () => {
    const { getByTestId } = renderConfetti()

    expect(getByTestId("confetti").props.pointerEvents).toBe("none")
  })

  it("unmounts once the burst ends", () => {
    const { queryByTestId } = renderConfetti()

    act(() => {
      lastCannonProps().onAnimationEnd()
    })

    expect(queryByTestId("confetti")).toBeNull()
  })

  /** A palette passed inline is a new array on every render; the burst keeps its colors. */
  it("keeps its colors when it renders again", () => {
    const view = renderConfetti({ colors: ["#111111"] })
    const first = lastCannonProps().colors

    view.rerender(
      <ThemeProvider theme={theme}>
        <Confetti colors={["#333333"]} />
      </ThemeProvider>,
    )

    expect(lastCannonProps().colors).toBe(first)
  })
})
