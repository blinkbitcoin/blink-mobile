import * as React from "react"
import { ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import {
  BulletinCarousel,
  CarouselItem,
} from "@app/components/notifications/bulletin-carousel"
import { BulletinCarouselItemContext } from "@app/components/notifications/bulletin-carousel-context"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

loadLocale("en")

jest.mock("@rn-vui/themed", () => ({
  makeStyles:
    (styles: (theme: { colors: Record<string, string> }) => Record<string, unknown>) =>
    () =>
      styles({ colors: { primary: "primary", grey4: "grey4" } }),
}))

const WIDTH = 360

/** A card that shows whether the carousel has it in view. */
const Card: React.FC<{ id: string }> = ({ id }) => {
  const { isActive } = React.useContext(BulletinCarouselItemContext)
  return (
    <View testID={`card-${id}`}>
      <Text>{`${id}:${isActive ? "active" : "inactive"}`}</Text>
    </View>
  )
}

const itemsOf = (...ids: string[]): CarouselItem[] =>
  ids.map((id) => ({ key: id, node: <Card id={id} /> }))

const ui = (items: CarouselItem[]) => (
  <TypesafeI18n locale="en">
    <BulletinCarousel items={items} />
  </TypesafeI18n>
)

const renderCarousel = (items: CarouselItem[], { laidOut = true } = {}) => {
  const rendered = render(ui(items))
  if (laidOut) layOut(rendered)
  return rendered
}

type Rendered = ReturnType<typeof render>

const layOut = (rendered: Rendered, width = WIDTH) =>
  fireEvent(rendered.UNSAFE_getByType(BulletinCarousel).children[0] as never, "layout", {
    nativeEvent: { layout: { width, height: 0 } },
  })

const indicator = (rendered: Rendered) => rendered.getByRole("adjustable")

const bars = (rendered: Rendered): ViewStyle[] =>
  React.Children.toArray(indicator(rendered).props.children).map((bar) =>
    StyleSheet.flatten((bar as React.ReactElement<{ style: ViewStyle }>).props.style),
  )

const swipeTo = (rendered: Rendered, index: number) =>
  fireEvent(rendered.getByTestId("bulletin-carousel"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: index * WIDTH } },
  })

const viewport = (rendered: Rendered) =>
  rendered
    .UNSAFE_getAllByType(View)
    .find((node) => StyleSheet.flatten(node.props.style)?.overflow === "hidden")

describe("BulletinCarousel", () => {
  it("renders nothing without items", () => {
    const rendered = render(ui([]))

    expect(rendered.toJSON()).toBeNull()
  })

  it("shows the first card alone, without bars, before its width is known", () => {
    const rendered = renderCarousel(itemsOf("a", "b"), { laidOut: false })

    expect(rendered.getByText("a:active")).toBeTruthy()
    expect(rendered.queryByTestId("card-b")).toBeNull()
    expect(rendered.queryByRole("adjustable")).toBeNull()
  })

  it("draws no bars and does not swipe with a single card", () => {
    const rendered = renderCarousel(itemsOf("a"))

    expect(rendered.queryByRole("adjustable")).toBeNull()
    expect(rendered.getByTestId("bulletin-carousel").props.scrollEnabled).toBe(false)
  })

  it("draws one bar per card, the one in view in primary", () => {
    const rendered = renderCarousel(itemsOf("a", "b", "c"))

    expect(bars(rendered).map(({ backgroundColor }) => backgroundColor)).toEqual([
      "primary",
      "grey4",
      "grey4",
    ])
    expect(
      bars(rendered).every(({ width, height }) => width === 20 && height === 2),
    ).toBe(true)
    expect(rendered.getByTestId("bulletin-carousel").props.scrollEnabled).toBe(true)
  })

  it("lays every card out as a page of the carousel's width", () => {
    const rendered = renderCarousel(itemsOf("a", "b"))

    const pages = rendered.UNSAFE_getByType(ScrollView).props
      .children as React.ReactElement<{
      style: ViewStyle
    }>[]
    expect(pages.map(({ props }) => StyleSheet.flatten(props.style).width)).toEqual([
      WIDTH,
      WIDTH,
    ])
  })

  it("follows a swipe: the bar, the announced position and the card in view", () => {
    const rendered = renderCarousel(itemsOf("a", "b", "c"))

    swipeTo(rendered, 2)

    expect(bars(rendered).map(({ backgroundColor }) => backgroundColor)).toEqual([
      "grey4",
      "grey4",
      "primary",
    ])
    expect(rendered.getByLabelText("Notification 3 of 3")).toBeTruthy()
    expect(rendered.getByText("a:inactive")).toBeTruthy()
    expect(rendered.getByText("c:active")).toBeTruthy()
  })

  it("clamps a swipe that overshoots to the last card", () => {
    const rendered = renderCarousel(itemsOf("a", "b"))

    swipeTo(rendered, 5)

    expect(rendered.getByLabelText("Notification 2 of 2")).toBeTruthy()
  })

  describe("screen readers", () => {
    it("announce the position as an adjustable element", () => {
      const rendered = renderCarousel(itemsOf("a", "b", "c"))

      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 1 of 3")
      expect(indicator(rendered).props.accessibilityActions).toEqual([
        { name: "increment" },
        { name: "decrement" },
      ])
    })

    it("swipe the carousel on increment and decrement", () => {
      const rendered = renderCarousel(itemsOf("a", "b", "c"))
      const scrollTo = jest.spyOn(
        rendered.UNSAFE_getByType(ScrollView).instance as ScrollView,
        "scrollTo",
      )
      const adjust = (actionName: string) =>
        fireEvent(indicator(rendered), "accessibilityAction", {
          nativeEvent: { actionName },
        })

      adjust("increment")
      expect(scrollTo).toHaveBeenLastCalledWith({ x: WIDTH, animated: true })
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 2 of 3")

      adjust("decrement")
      expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true })
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 1 of 3")
    })

    it("stay put past either end", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))
      const adjust = (actionName: string) =>
        fireEvent(indicator(rendered), "accessibilityAction", {
          nativeEvent: { actionName },
        })

      adjust("decrement")
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 1 of 2")

      adjust("increment")
      adjust("increment")
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 2 of 2")
    })
  })

  describe("when the list changes", () => {
    it("keeps the card being read in view when a refetch adds one before it", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))
      swipeTo(rendered, 1)

      rendered.rerender(ui(itemsOf("new", "a", "b")))

      expect(rendered.getByText("b:active")).toBeTruthy()
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 3 of 3")
    })

    it("puts the scroll back on that card without animating", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))
      const scrollTo = jest.spyOn(
        rendered.UNSAFE_getByType(ScrollView).instance as ScrollView,
        "scrollTo",
      )
      fireEvent.scroll(rendered.getByTestId("bulletin-carousel"), {
        nativeEvent: { contentOffset: { x: WIDTH } },
      })
      swipeTo(rendered, 1)

      rendered.rerender(ui(itemsOf("new", "a", "b")))

      expect(scrollTo).toHaveBeenLastCalledWith({ x: 2 * WIDTH, animated: false })
    })

    it("brings the next card in when the one in view closes", () => {
      const rendered = renderCarousel(itemsOf("a", "b", "c"))
      swipeTo(rendered, 1)

      rendered.rerender(ui(itemsOf("a", "c")))

      expect(rendered.getByText("c:active")).toBeTruthy()
      expect(indicator(rendered).props.accessibilityLabel).toBe("Notification 2 of 2")
    })

    it("falls back to the new last card when the last one in view closes", () => {
      const rendered = renderCarousel(itemsOf("a", "b", "c"))
      swipeTo(rendered, 2)

      rendered.rerender(ui(itemsOf("a", "b")))

      expect(rendered.getByText("b:active")).toBeTruthy()
    })

    it("drops the bars once a single card is left", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))

      rendered.rerender(ui(itemsOf("b")))

      expect(rendered.queryByRole("adjustable")).toBeNull()
      expect(rendered.getByText("b:active")).toBeTruthy()
    })
  })

  describe("height", () => {
    const measure = (rendered: Rendered, id: string, height: number) =>
      act(() => {
        fireEvent(rendered.getByTestId(`card-${id}`), "layout", {
          nativeEvent: { layout: { width: WIDTH, height } },
        })
      })

    it("takes the height of the card in view, and follows a swipe", () => {
      const rendered = renderCarousel(itemsOf("short", "tall"))
      measure(rendered, "short", 80)
      measure(rendered, "tall", 200)

      expect(StyleSheet.flatten(viewport(rendered)?.props.style).height).toBe(80)

      swipeTo(rendered, 1)

      expect(StyleSheet.flatten(viewport(rendered)?.props.style).height).toBe(200)
    })

    it("follows the card in view as it grows", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))
      measure(rendered, "a", 80)

      measure(rendered, "a", 140)

      expect(StyleSheet.flatten(viewport(rendered)?.props.style).height).toBe(140)
    })

    it("leaves the height free until the card in view is measured", () => {
      const rendered = renderCarousel(itemsOf("a", "b"))
      measure(rendered, "b", 200)

      expect(StyleSheet.flatten(viewport(rendered)?.props.style).height).toBeUndefined()
    })
  })
})
