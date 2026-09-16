import React from "react"
import { StyleSheet } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import {
  SEND_HERO_CAPTION_TEST_ID,
  SEND_HERO_PRIMARY_TEST_ID,
  SEND_HERO_SECONDARY_TEST_ID,
  SendHero,
} from "@app/screens/send-bitcoin-screen/send-hero"

const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style)

const renderHero = (props: Partial<React.ComponentProps<typeof SendHero>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <SendHero caption="Sending" primaryAmount="$0.57" {...props} />
    </ThemeProvider>,
  )

describe("SendHero", () => {
  it("shows the caption, the amount and the wallet-unit amount", () => {
    renderHero({ secondaryAmount: "746 SAT" })

    expect(screen.getByTestId(SEND_HERO_CAPTION_TEST_ID).props.children).toBe("Sending")
    expect(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID).props.children).toBe("$0.57")
    expect(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID).props.children).toBe("746 SAT")
  })

  it("drops the second line when there is no second currency", () => {
    renderHero()

    expect(screen.queryByTestId(SEND_HERO_SECONDARY_TEST_ID)).toBeNull()
  })

  it("draws the send icon at 32 with no background behind it", () => {
    renderHero()

    const icon = screen.getByTestId("icon-send")
    const frame = icon.parent?.parent
    expect(style(frame as ReactTestInstance)).toEqual(
      expect.objectContaining({ width: 44, height: 44 }),
    )
    expect(style(frame as ReactTestInstance).backgroundColor).toBeUndefined()
  })

  /** Review reads the amount back at Figma's heading sizes. */
  it("uses the settled type sizes when it is not active", () => {
    renderHero({ secondaryAmount: "746 SAT" })

    expect(style(screen.getByTestId(SEND_HERO_CAPTION_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 12, lineHeight: 18 }),
    )
    expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 20, lineHeight: 24 }),
    )
    expect(style(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 14, lineHeight: 20 }),
    )
  })

  /** Amount entry leads with the amount being typed, so both lines are larger there. */
  it("uses the entry type sizes when it is active", () => {
    renderHero({ active: true, secondaryAmount: "746 SAT" })

    expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 26, lineHeight: 34 }),
    )
    expect(style(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 18, lineHeight: 24 }),
    )
  })

  it("mutes both lines while the amount is still empty", () => {
    renderHero({ active: true, isEmpty: true, secondaryAmount: "0 SAT" })

    expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID)).color).toBe(light.grey2)
    expect(style(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID)).color).toBe(light.grey3)
  })

  it("swaps the typed currency when the amount is pressed", () => {
    const onSwapCurrency = jest.fn()
    renderHero({ active: true, secondaryAmount: "746 SAT", onSwapCurrency })

    fireEvent.press(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))

    expect(onSwapCurrency).toHaveBeenCalledTimes(1)
  })

  it("copies the caption on a long press where one is offered", () => {
    const onCaptionLongPress = jest.fn()
    renderHero({ active: true, onCaptionLongPress })

    fireEvent(screen.getByTestId(SEND_HERO_CAPTION_TEST_ID), "longPress")

    expect(onCaptionLongPress).toHaveBeenCalledTimes(1)
  })
})
