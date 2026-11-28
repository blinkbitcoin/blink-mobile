import React from "react"
import { AccessibilityInfo, PixelRatio, StyleSheet } from "react-native"
import { useSharedValue } from "react-native-reanimated"
import { ReactTestInstance } from "react-test-renderer"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SuccessBadge } from "@app/components/success-badge"
import { light } from "@app/rne-theme/colors"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"
import theme from "@app/rne-theme/theme"
import {
  SEND_HERO_CAPTION_TEST_ID,
  SEND_HERO_PRIMARY_TEST_ID,
  SEND_HERO_SECONDARY_TEST_ID,
  SendHero,
  entryAmountFontSize,
  sentHeroGrowth,
} from "@app/screens/send-bitcoin-screen/send-hero"

const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style)

/** Stands in for the bounce's peak, so the scale it drives can be read off the lines. */
const BOUNCE_PEAK = 1.3
const mockUseBounceInAnimation = jest.fn(
  ({ visible, scale }: { visible: boolean; scale: { value: number } }) => {
    scale.value = visible ? BOUNCE_PEAK : 1
    return visible
  },
)
jest.mock("@app/components/animations", () => ({
  ...jest.requireActual("@app/components/animations"),
  useBounceInAnimation: (args: never) => mockUseBounceInAnimation(args),
}))

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

  /** Reanimated's Animated.Text is React Native's Text, which the theme's ceiling never
   *  reaches, so each line carries it, the same one `sentHeroGrowth` centres by. */
  it("caps every line at the text-size ceiling", () => {
    renderHero({ secondaryAmount: "746 SAT" })

    for (const testID of [
      SEND_HERO_CAPTION_TEST_ID,
      SEND_HERO_PRIMARY_TEST_ID,
      SEND_HERO_SECONDARY_TEST_ID,
    ]) {
      expect(screen.getByTestId(testID).props.maxFontSizeMultiplier).toBe(
        MAX_FONT_SIZE_MULTIPLIER,
      )
    }
  })

  describe("sentHeroGrowth", () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    /** Icon frame 44 → 72 plus 10 more gap (38), caption 18 → 22 (4), and the amount's line
     *  from 24 to amount entry's size plus 2. */
    const cases: Array<[amount: string, hasSecondary: boolean, expected: number]> = [
      ["$10.00", false, 38 + 4 + (36 + 2 - 24)],
      ["$10.00", true, 38 + 4 + (36 + 2 - 24) + (22 - 20)],
      ["1,000,000,000 SAT", false, 38 + 4 + (22 + 2 - 24)],
    ]

    cases.forEach(([primaryAmount, hasSecondaryAmount, expected]) => {
      it(`grows ${primaryAmount} (second line: ${hasSecondaryAmount}) by ${expected}`, () => {
        jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1)

        expect(sentHeroGrowth({ primaryAmount, hasSecondaryAmount })).toBe(expected)
      })
    })

    /** The text lines follow the OS text size, line box included; the icon frame does not. */
    it("scales the text lines' growth with the OS text size, and not the icon's", () => {
      jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.2)

      expect(
        sentHeroGrowth({ primaryAmount: "$10.00", hasSecondaryAmount: true }),
      ).toBeCloseTo(38 + 1.2 * (4 + (36 + 2 - 24) + (22 - 20)), 5)
    })

    /** The lines stop growing at the ceiling, so the centring stops with them. */
    it("stops the text lines' growth at the text-size ceiling", () => {
      jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(3)

      expect(
        sentHeroGrowth({ primaryAmount: "$10.00", hasSecondaryAmount: true }),
      ).toBeCloseTo(38 + MAX_FONT_SIZE_MULTIPLIER * (4 + (36 + 2 - 24) + (22 - 20)), 5)
    })
  })

  describe("bounce", () => {
    const scaleOf = (testID: string) =>
      (style(screen.getByTestId(testID)).transform ?? []).find(
        (step: object) => "scale" in step,
      )

    it("bounces both lines once when the amount is flagged, to 1.3 in 80 ms steps", () => {
      renderHero({ secondaryAmount: "746 SAT", isAmountBounced: true })

      expect(mockUseBounceInAnimation).toHaveBeenLastCalledWith(
        expect.objectContaining({
          visible: true,
          delay: 300,
          duration: 80,
          isSingleBounce: true,
          peak: 1.3,
        }),
      )
      expect(scaleOf(SEND_HERO_PRIMARY_TEST_ID)).toEqual({ scale: BOUNCE_PEAK })
      expect(scaleOf(SEND_HERO_SECONDARY_TEST_ID)).toEqual({ scale: BOUNCE_PEAK })
    })

    it("holds the amount still by default", () => {
      renderHero({ secondaryAmount: "746 SAT" })

      expect(mockUseBounceInAnimation).toHaveBeenLastCalledWith(
        expect.objectContaining({ visible: false }),
      )
      expect(scaleOf(SEND_HERO_PRIMARY_TEST_ID)).toEqual({ scale: 1 })
    })

    /** The swap's own scale is what the typed amount needs, so the bounce never takes it. */
    it("leaves an active hero's swap transform in charge", () => {
      renderHero({ active: true, isAmountBounced: true, primaryCurrency: "USD" })

      expect(scaleOf(SEND_HERO_PRIMARY_TEST_ID)).not.toEqual({ scale: BOUNCE_PEAK })
    })
  })

  describe("turning into Sent", () => {
    type SentHeroProps = Partial<React.ComponentProps<typeof SendHero>> & {
      progress: number
    }

    /** Review hands the hero its Sent progress as a shared value. */
    const SentHero = ({ progress, ...props }: SentHeroProps) => {
      const sentProgress = useSharedValue(progress)
      return (
        <SendHero
          caption="Sent"
          primaryAmount="$10.00"
          sentProgress={sentProgress}
          {...props}
        />
      )
    }

    const sentHero = (props: SentHeroProps) => (
      <TypesafeI18n locale="en">
        <ThemeProvider theme={theme}>
          <SentHero {...props} />
        </ThemeProvider>
      </TypesafeI18n>
    )

    const ancestorStyles = (node: ReactTestInstance) => {
      const styles = []
      for (let at = node.parent; at; at = at.parent) styles.push(style(at) ?? {})
      return styles
    }

    const badges = () => screen.UNSAFE_queryAllByType(SuccessBadge)

    it("keeps the send glyph and draws no badge before the payment lands", () => {
      render(sentHero({ progress: 0 }))

      expect(screen.getByTestId("icon-send")).toBeTruthy()
      expect(badges()).toHaveLength(0)
    })

    it("draws the badge once the payment lands", () => {
      render(sentHero({ progress: 0, isSent: true, sentPlay: 1 }))

      expect(badges()).toHaveLength(1)
    })

    /** A payment that landed while the sender was away holds the badge back until they
     *  return. */
    it("holds the badge back while no play has started", () => {
      render(sentHero({ progress: 0, isSent: true, sentPlay: 0 }))

      expect(badges()).toHaveLength(0)
    })

    it("mounts the badge afresh for each play", () => {
      const { rerender } = render(sentHero({ progress: 0, isSent: true, sentPlay: 1 }))
      const firstBadge = badges()[0]

      rerender(sentHero({ progress: 0, isSent: true, sentPlay: 2 }))

      expect(badges()).toHaveLength(1)
      expect(badges()[0]).not.toBe(firstBadge)
    })

    it("draws the badge in on a play, and shows it drawn when Sent comes back at its end", () => {
      const { rerender } = render(sentHero({ progress: 0, isSent: true, sentPlay: 1 }))
      expect(badges()[0].props.isDrawn).toBe(false)

      rerender(sentHero({ progress: 1, isSent: true, sentPlay: 2, isSentAtEnd: true }))
      expect(badges()[0].props.isDrawn).toBe(true)
    })

    it("starts from review's sizes", () => {
      render(sentHero({ progress: 0, secondaryAmount: "746 SAT" }))

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

    /** Figma's Sent: caption 16/22, the amount at the size it was typed at, wallet unit
     *  16/22. */
    it("lands on Sent's sizes", () => {
      render(sentHero({ progress: 1, secondaryAmount: "746 SAT" }))

      expect(style(screen.getByTestId(SEND_HERO_CAPTION_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 16, lineHeight: 22 }),
      )
      expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 36, lineHeight: 38 }),
      )
      expect(style(screen.getByTestId(SEND_HERO_SECONDARY_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 16, lineHeight: 22 }),
      )
    })

    it("lands a long amount at amount entry's size for it", () => {
      render(sentHero({ progress: 1, primaryAmount: "1,000,000,000 SAT" }))

      expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 22, lineHeight: 24 }),
      )
    })

    it("grows the icon frame from 44 to 72, 10 further off the caption", () => {
      render(sentHero({ progress: 0 }))
      expect(ancestorStyles(screen.getByTestId("icon-send"))).toContainEqual(
        expect.objectContaining({ width: 44, height: 44, marginBottom: 0 }),
      )
      screen.unmount()

      render(sentHero({ progress: 1 }))
      expect(ancestorStyles(screen.getByTestId("icon-send"))).toContainEqual(
        expect.objectContaining({ width: 72, height: 72, marginBottom: 10 }),
      )
    })

    it("fades the send glyph out as the badge takes its place", () => {
      render(sentHero({ progress: 0 }))
      expect(ancestorStyles(screen.getByTestId("icon-send"))).toContainEqual(
        expect.objectContaining({ opacity: 1 }),
      )
      screen.unmount()

      render(sentHero({ progress: 1 }))
      expect(ancestorStyles(screen.getByTestId("icon-send"))).toContainEqual(
        expect.objectContaining({ opacity: 0 }),
      )
    })

    it("reads Sent and the amount to a screen reader", () => {
      render(sentHero({ progress: 1, isSent: true, secondaryAmount: "746 SAT" }))

      expect(screen.getByLabelText("Sent")).toBeTruthy()
      expect(screen.getByLabelText("$10.00, 746 SAT")).toBeTruthy()
    })

    /** Amount entry passes no Sent progress and keeps its own sizes. */
    it("leaves an active hero at amount entry's sizes", () => {
      render(sentHero({ progress: 1, active: true }))

      expect(style(screen.getByTestId(SEND_HERO_PRIMARY_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 36, lineHeight: 38 }),
      )
      expect(style(screen.getByTestId(SEND_HERO_CAPTION_TEST_ID))).toEqual(
        expect.objectContaining({ fontSize: 12, lineHeight: 18 }),
      )
    })
  })
})
