import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { WarningCard } from "@app/components/card-screen/warning-card"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        warning: "#FFA726",
        grey2: "#666666",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    header: {},
    title: {},
    description: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`}>
      <RNText>{name}</RNText>
      <RNText testID={`galoy-icon-${name}-color`}>{color}</RNText>
    </View>
  ),
}))

describe("WarningCard", () => {
  const defaultProps = {
    title: "Keep your details safe",
    description:
      "Never share your card details with anyone. Blink will never ask for your card information via email or phone.",
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<WarningCard {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the title", () => {
      const { getByText } = render(<WarningCard {...defaultProps} />)

      expect(getByText("Keep your details safe")).toBeTruthy()
    })

    it("displays the description", () => {
      const { getByText } = render(<WarningCard {...defaultProps} />)

      expect(
        getByText(
          "Never share your card details with anyone. Blink will never ask for your card information via email or phone.",
        ),
      ).toBeTruthy()
    })

    it("renders the default warning icon", () => {
      const { getByTestId } = render(<WarningCard {...defaultProps} />)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })
  })

  describe("custom icon", () => {
    it("renders with custom icon", () => {
      const { getByTestId } = render(<WarningCard {...defaultProps} icon="info" />)

      expect(getByTestId("galoy-icon-info")).toBeTruthy()
    })

    it("renders with question icon", () => {
      const { getByTestId } = render(<WarningCard {...defaultProps} icon="question" />)

      expect(getByTestId("galoy-icon-question")).toBeTruthy()
    })

    it("uses default warning icon when not specified", () => {
      const { getByTestId, queryByTestId } = render(<WarningCard {...defaultProps} />)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
      expect(queryByTestId("galoy-icon-info")).toBeNull()
    })
  })

  describe("different content", () => {
    it("renders with transaction help content", () => {
      const { getByText } = render(
        <WarningCard
          title="Need help with this transaction?"
          description="If something doesn't look right, please contact our support team for assistance."
        />,
      )

      expect(getByText("Need help with this transaction?")).toBeTruthy()
      expect(
        getByText(
          "If something doesn't look right, please contact our support team for assistance.",
        ),
      ).toBeTruthy()
    })

    it("renders with short title", () => {
      const { getByText } = render(
        <WarningCard title="Warning" description="Be careful." />,
      )

      expect(getByText("Warning")).toBeTruthy()
    })

    it("renders with long description", () => {
      const longDescription =
        "This is a very long description that contains multiple sentences. It should still render correctly without any issues. The component should handle text of any reasonable length."

      const { getByText } = render(
        <WarningCard title="Notice" description={longDescription} />,
      )

      expect(getByText(longDescription)).toBeTruthy()
    })
  })

  describe("icon color", () => {
    it("renders icon with warning color", () => {
      const { getByTestId } = render(<WarningCard {...defaultProps} />)

      expect(getByTestId("galoy-icon-warning-color").props.children).toBe("#FFA726")
    })
  })

  describe("content variations", () => {
    it("renders card details warning", () => {
      const { getByText } = render(
        <WarningCard
          title="Keep your details safe"
          description="Never share your card details with anyone."
        />,
      )

      expect(getByText("Keep your details safe")).toBeTruthy()
      expect(getByText("Never share your card details with anyone.")).toBeTruthy()
    })

    it("renders transaction help warning", () => {
      const { getByText } = render(
        <WarningCard
          title="Need help with this transaction?"
          description="Contact support if something looks wrong."
        />,
      )

      expect(getByText("Need help with this transaction?")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates content when props change", () => {
      const { getByText, rerender } = render(<WarningCard {...defaultProps} />)

      expect(getByText("Keep your details safe")).toBeTruthy()

      rerender(<WarningCard title="New title" description="New description" />)

      expect(getByText("New title")).toBeTruthy()
      expect(getByText("New description")).toBeTruthy()
    })

    it("updates icon when prop changes", () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <WarningCard {...defaultProps} />,
      )

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()

      rerender(<WarningCard {...defaultProps} icon="info" />)

      expect(getByTestId("galoy-icon-info")).toBeTruthy()
      expect(queryByTestId("galoy-icon-warning")).toBeNull()
    })
  })
})
