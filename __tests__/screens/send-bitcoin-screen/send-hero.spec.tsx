import React from "react"
import { AccessibilityInfo, StyleSheet } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import {
  SEND_HERO_CAPTION_TEST_ID,
  SEND_HERO_PRIMARY_TEST_ID,
  SEND_HERO_SECONDARY_TEST_ID,
  SendHero,
  entryAmountFontSize,
} from "@app/screens/send-bitcoin-screen/send-hero"

const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style)

loadLocale("en")

const hero = (props: Partial<React.ComponentProps<typeof SendHero>> = {}) => (
  <TypesafeI18n locale="en">
    <ThemeProvider theme={theme}>
      <SendHero caption="Sending" primaryAmount="$0.57" {...props} />
    </ThemeProvider>
  </TypesafeI18n>
)

const renderHero = (props: Partial<React.ComponentProps<typeof SendHero>> = {}) =>
  render(hero(props))

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
      expect.objectContaining({ fontSize: 36, lineHeight: 38 }),
    )
    expect(style(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 18, lineHeight: 24 }),
    )
  })

  it("draws an empty entry amount at 36 on 38", () => {
    renderHero({ active: true, isEmpty: true, primaryAmount: "$0.00" })

    expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 36, lineHeight: 38 }),
    )
  })

  it("stops shrinking the entry amount at 22 on 24 from ten digits", () => {
    renderHero({ active: true, primaryAmount: "1,000,000,000 SAT" })

    expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 22, lineHeight: 24 }),
    )
  })

  describe("entryAmountFontSize", () => {
    const cases: Array<[amount: string, isEmpty: boolean, expected: number]> = [
      ["$0", false, 36],
      ["$0.00", true, 36],
      ["$5", false, 36],
      ["$12", false, 36],
      ["12,345 SAT", false, 36],
      ["123,456 SAT", false, 33],
      ["12,345,678 SAT", false, 28],
      ["100,000,000 SAT", false, 25],
      ["1,000,000,000 SAT", false, 22],
      ["$1,234,567,890.12", false, 22],
    ]

    cases.forEach(([amount, isEmpty, expected]) => {
      it(`sizes ${amount} (empty: ${isEmpty}) at ${expected}`, () => {
        expect(entryAmountFontSize(amount, isEmpty)).toBe(expected)
      })
    })
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

  describe("screen reader", () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest
        .spyOn(AccessibilityInfo, "announceForAccessibility")
        .mockImplementation(() => {})
      jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.restoreAllMocks()
    })

    /** Reads the amount, not the test IDs on its lines. */
    it("reads the caption and both amounts as their text", () => {
      renderHero({ caption: "alice@blink.sv", secondaryAmount: "746 SAT" })

      expect(screen.getByLabelText("alice@blink.sv")).toBeTruthy()
      expect(screen.getByLabelText("$0.57, 746 SAT")).toBeTruthy()
      expect(screen.queryByLabelText(SEND_HERO_PRIMARY_TEST_ID)).toBeNull()
      expect(screen.queryByLabelText(SEND_HERO_CAPTION_TEST_ID)).toBeNull()
    })

    it("offers the caption's copy as an action, since a long press can't be found by ear", () => {
      const onCaptionLongPress = jest.fn()
      renderHero({ caption: "alice@blink.sv", onCaptionLongPress })

      const caption = screen.getByLabelText("alice@blink.sv")
      expect(caption.props.accessibilityActions).toEqual([
        { name: "longpress", label: "Copy" },
      ])
      fireEvent(caption, "accessibilityAction", {
        nativeEvent: { actionName: "longpress" },
      })

      expect(onCaptionLongPress).toHaveBeenCalledTimes(1)
    })

    it("says what pressing the amount does where it swaps the currency", () => {
      renderHero({ active: true, secondaryAmount: "746 SAT", onSwapCurrency: jest.fn() })

      expect(screen.getByLabelText("$0.57, 746 SAT").props.accessibilityHint).toBe(
        "Switches the currency you type the amount in",
      )
    })

    it("speaks the amount once typing pauses, and only the last one", () => {
      const { rerender } = render(hero({ active: true, secondaryAmount: "0 SAT" }))
      act(() => jest.runAllTimers())
      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled()

      rerender(hero({ active: true, primaryAmount: "$1", secondaryAmount: "1,300 SAT" }))
      rerender(
        hero({ active: true, primaryAmount: "$12", secondaryAmount: "15,600 SAT" }),
      )
      act(() => jest.runAllTimers())

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        "$12, 15,600 SAT",
      )
    })

    it("stays quiet about a settled amount", () => {
      const { rerender } = render(hero({ primaryAmount: "$1" }))
      rerender(hero({ primaryAmount: "$2" }))
      act(() => jest.runAllTimers())

      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled()
    })
  })
})
