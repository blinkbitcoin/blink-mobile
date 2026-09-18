import React from "react"
import { StyleSheet, Text as RNText, View } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { render, screen } from "@testing-library/react-native"

import {
  INFO_SECTION_OUTLINE_TEST_ID,
  InfoSection,
} from "@app/components/card-screen/info-section"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        grey2: "#666666",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    title: {},
    card: { backgroundColor: "#F5F5F5", padding: 14 },
    cardInactive: { backgroundColor: "#F9F9F9" },
    outline: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderWidth: 1,
    },
  }),
}))

jest.mock("@app/components/card-screen/info-row", () => ({
  InfoRow: ({
    label,
    value,
    valueColor,
  }: {
    label: string
    value: string
    valueColor?: string
  }) => (
    <View testID={`info-row-${label}`}>
      <RNText testID={`label-${label}`}>{label}</RNText>
      <RNText testID={`value-${label}`}>{value}</RNText>
      {valueColor && <RNText testID={`value-color-${label}`}>{valueColor}</RNText>}
    </View>
  ),
}))

describe("InfoSection", () => {
  const defaultProps = {
    title: "Card information",
    items: [
      { label: "Amount", value: "-$12.50" },
      { label: "Time", value: "Jan 30, 10:58 AM" },
    ],
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<InfoSection {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the section title", () => {
      const { getByText } = render(<InfoSection {...defaultProps} />)

      expect(getByText("Card information")).toBeTruthy()
    })

    it("renders all info rows", () => {
      const { getByTestId } = render(<InfoSection {...defaultProps} />)

      expect(getByTestId("info-row-Amount")).toBeTruthy()
      expect(getByTestId("info-row-Time")).toBeTruthy()
    })

    it("displays correct labels", () => {
      const { getByTestId } = render(<InfoSection {...defaultProps} />)

      expect(getByTestId("label-Amount")).toBeTruthy()
      expect(getByTestId("label-Time")).toBeTruthy()
    })

    it("displays correct values", () => {
      const { getByTestId } = render(<InfoSection {...defaultProps} />)

      expect(getByTestId("value-Amount").props.children).toBe("-$12.50")
      expect(getByTestId("value-Time").props.children).toBe("Jan 30, 10:58 AM")
    })
  })

  describe("different section titles", () => {
    it("renders with merchant information title", () => {
      const { getByText } = render(
        <InfoSection
          title="Merchant information"
          items={[{ label: "Merchant", value: "SuperSelectos" }]}
        />,
      )

      expect(getByText("Merchant information")).toBeTruthy()
    })

    it("renders with currency conversion title", () => {
      const { getByText } = render(
        <InfoSection
          title="Currency conversion"
          items={[{ label: "Bitcoin rate", value: "$102,450.00" }]}
        />,
      )

      expect(getByText("Currency conversion")).toBeTruthy()
    })
  })

  describe("multiple items", () => {
    it("renders with single item", () => {
      const { getByTestId } = render(
        <InfoSection title="Single" items={[{ label: "Label1", value: "Value1" }]} />,
      )

      expect(getByTestId("info-row-Label1")).toBeTruthy()
    })

    it("renders with multiple items", () => {
      const items = [
        { label: "Amount", value: "-$12.50" },
        { label: "Time", value: "Jan 30, 10:58 AM" },
        { label: "Transaction ID", value: "TXN-2025-000001" },
        { label: "Card used", value: "Visa •••• 2121" },
        { label: "Payment method", value: "Chip" },
      ]

      const { getByTestId } = render(<InfoSection title="Card info" items={items} />)

      items.forEach((item) => {
        expect(getByTestId(`info-row-${item.label}`)).toBeTruthy()
      })
    })

    it("renders items in correct order", () => {
      const items = [
        { label: "First", value: "1" },
        { label: "Second", value: "2" },
        { label: "Third", value: "3" },
      ]

      const { getAllByTestId } = render(<InfoSection title="Ordered" items={items} />)

      const rows = getAllByTestId(/^info-row-/)
      expect(rows).toHaveLength(3)
    })
  })

  describe("with value colors", () => {
    it("passes valueColor to InfoRow", () => {
      const { getByTestId } = render(
        <InfoSection
          title="Colors"
          items={[{ label: "Fee", value: "$0.00", valueColor: "#00C853" }]}
        />,
      )

      expect(getByTestId("value-color-Fee").props.children).toBe("#00C853")
    })

    it("handles mixed items with and without colors", () => {
      const items = [
        { label: "Amount", value: "-$12.50" },
        { label: "Fee", value: "$0.00", valueColor: "#00C853" },
        { label: "Total", value: "-$12.50" },
      ]

      const { getByTestId, queryByTestId } = render(
        <InfoSection title="Mixed" items={items} />,
      )

      expect(queryByTestId("value-color-Amount")).toBeNull()
      expect(getByTestId("value-color-Fee").props.children).toBe("#00C853")
      expect(queryByTestId("value-color-Total")).toBeNull()
    })
  })

  describe("card information section", () => {
    it("renders complete card information section", () => {
      const items = [
        { label: "Amount", value: "-$12.50" },
        { label: "Time", value: "Jan 30, 10:58 AM" },
        { label: "Transaction ID", value: "TXN-2025-000001" },
        { label: "Card used", value: "Visa •••• 2121" },
        { label: "Payment method", value: "Chip" },
      ]

      const { getByText, getByTestId } = render(
        <InfoSection title="Card information" items={items} />,
      )

      expect(getByText("Card information")).toBeTruthy()
      expect(getByTestId("value-Amount").props.children).toBe("-$12.50")
      expect(getByTestId("value-Transaction ID").props.children).toBe("TXN-2025-000001")
    })
  })

  describe("merchant information section", () => {
    it("renders complete merchant information section", () => {
      const items = [
        { label: "Merchant", value: "SuperSelectos" },
        { label: "Category", value: "Groceries" },
        { label: "Location", value: "Blvd. Los Héroes, San Salvador, El Salvador" },
        { label: "MCC code", value: "5411" },
      ]

      const { getByText, getByTestId } = render(
        <InfoSection title="Merchant information" items={items} />,
      )

      expect(getByText("Merchant information")).toBeTruthy()
      expect(getByTestId("value-Merchant").props.children).toBe("SuperSelectos")
      expect(getByTestId("value-Location").props.children).toBe(
        "Blvd. Los Héroes, San Salvador, El Salvador",
      )
    })
  })

  describe("currency conversion section", () => {
    it("renders complete currency conversion section with colored fee", () => {
      const items = [
        { label: "Bitcoin rate", value: "$102,450.00" },
        { label: "Bitcoin spent", value: "12,203 SAT" },
        { label: "Conversion fee", value: "$0.00", valueColor: "#00C853" },
      ]

      const { getByText, getByTestId } = render(
        <InfoSection title="Currency conversion" items={items} />,
      )

      expect(getByText("Currency conversion")).toBeTruthy()
      expect(getByTestId("value-Bitcoin rate").props.children).toBe("$102,450.00")
      expect(getByTestId("value-color-Conversion fee").props.children).toBe("#00C853")
    })
  })

  describe("empty states", () => {
    it("renders with empty items array", () => {
      const { getByText } = render(<InfoSection title="Empty" items={[]} />)

      expect(getByText("Empty")).toBeTruthy()
    })

    it("renders with empty value", () => {
      const { getByTestId } = render(
        <InfoSection title="Empty Value" items={[{ label: "Empty", value: "" }]} />,
      )

      expect(getByTestId("value-Empty").props.children).toBe("")
    })
  })

  /** The card is the one View carrying the card padding in the style mock. */
  const cardStyle = (views: ReactTestInstance[]) =>
    views
      .map((view) => StyleSheet.flatten(view.props.style))
      .find((style) => style?.padding === 14)

  describe("inactive surface", () => {
    it("paints the card on the static grey7 surface when inactive", () => {
      render(<InfoSection {...defaultProps} inactive />)

      expect(cardStyle(screen.UNSAFE_getAllByType(View))?.backgroundColor).toBe("#F9F9F9")
    })

    it("keeps the grey5 surface by default", () => {
      render(<InfoSection {...defaultProps} />)

      expect(cardStyle(screen.UNSAFE_getAllByType(View))?.backgroundColor).toBe("#F5F5F5")
    })
  })

  describe("outline", () => {
    it("draws no outline without an outlineColor", () => {
      const { queryByTestId } = render(<InfoSection {...defaultProps} />)

      expect(queryByTestId(INFO_SECTION_OUTLINE_TEST_ID)).toBeNull()
    })

    it("draws the outline in the given colour", () => {
      const { getByTestId } = render(
        <InfoSection {...defaultProps} outlineColor="#DC2626" />,
      )

      const outline = StyleSheet.flatten(
        getByTestId(INFO_SECTION_OUTLINE_TEST_ID).props.style,
      )
      expect(outline.borderColor).toBe("#DC2626")
      expect(outline.borderWidth).toBe(1)
    })

    /** Drawn over the card rather than as its border, so the rows don't move when an error
     *  outlines the card. */
    it("overlays the card instead of bordering it, so the rows keep their place", () => {
      const { getByTestId } = render(
        <InfoSection {...defaultProps} outlineColor="#DC2626" />,
      )

      const outline = getByTestId(INFO_SECTION_OUTLINE_TEST_ID)
      expect(StyleSheet.flatten(outline.props.style).position).toBe("absolute")
      expect(outline.props.pointerEvents).toBe("none")
      expect(cardStyle(screen.UNSAFE_getAllByType(View))?.borderWidth).toBeUndefined()
    })
  })
})
