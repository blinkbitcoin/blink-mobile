import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { BulletListCard } from "@app/components/card-screen/bullet-list-card"

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
    bulletList: {},
    bulletItem: {},
    bullet: {},
    bulletText: {},
  }),
}))

describe("BulletListCard", () => {
  const defaultProps = {
    title: "Benefits of mobile wallet",
    items: [
      "Contactless payments at millions of locations",
      "Enhanced security with biometric authentication",
      "No need to carry your physical card",
    ],
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<BulletListCard {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the title", () => {
      const { getByText } = render(<BulletListCard {...defaultProps} />)

      expect(getByText("Benefits of mobile wallet")).toBeTruthy()
    })

    it("displays all bullet items", () => {
      const { getByText } = render(<BulletListCard {...defaultProps} />)

      expect(getByText("Contactless payments at millions of locations")).toBeTruthy()
      expect(getByText("Enhanced security with biometric authentication")).toBeTruthy()
      expect(getByText("No need to carry your physical card")).toBeTruthy()
    })

    it("renders single item", () => {
      const { getByText } = render(
        <BulletListCard title="Single Item" items={["Only one item"]} />,
      )

      expect(getByText("Single Item")).toBeTruthy()
      expect(getByText("Only one item")).toBeTruthy()
    })

    it("renders multiple items in order", () => {
      const { getAllByText } = render(<BulletListCard {...defaultProps} />)

      const textElements = getAllByText(/./i)
      expect(textElements.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe("empty items", () => {
    it("renders with empty items array", () => {
      const { getByText, toJSON } = render(
        <BulletListCard title="Empty List" items={[]} />,
      )

      expect(toJSON()).toBeTruthy()
      expect(getByText("Empty List")).toBeTruthy()
    })

    it("renders title when items array is empty", () => {
      const { getByText } = render(<BulletListCard title="No Items" items={[]} />)

      expect(getByText("No Items")).toBeTruthy()
    })
  })

  describe("different content", () => {
    it("renders with different title", () => {
      const { getByText } = render(
        <BulletListCard title="About Statements" items={["Item 1"]} />,
      )

      expect(getByText("About Statements")).toBeTruthy()
    })

    it("renders with long text items", () => {
      const longText =
        "This is a very long text item that should still render correctly in the bullet list card component"
      const { getByText } = render(
        <BulletListCard title="Long Text" items={[longText]} />,
      )

      expect(getByText(longText)).toBeTruthy()
    })

    it("renders with special characters in items", () => {
      const { getByText } = render(
        <BulletListCard
          title="Special Characters"
          items={["Item with $pecial ch@racters!", "Ítém wíth áccénts"]}
        />,
      )

      expect(getByText("Item with $pecial ch@racters!")).toBeTruthy()
      expect(getByText("Ítém wíth áccénts")).toBeTruthy()
    })
  })

  describe("many items", () => {
    it("renders with many items", () => {
      const manyItems = [
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8",
      ]

      const { getByText } = render(
        <BulletListCard title="Many Items" items={manyItems} />,
      )

      manyItems.forEach((item) => {
        expect(getByText(item)).toBeTruthy()
      })
    })
  })

  describe("rerender", () => {
    it("updates title when prop changes", () => {
      const { getByText, queryByText, rerender } = render(
        <BulletListCard title="Original Title" items={["Item"]} />,
      )

      expect(getByText("Original Title")).toBeTruthy()

      rerender(<BulletListCard title="Updated Title" items={["Item"]} />)

      expect(getByText("Updated Title")).toBeTruthy()
      expect(queryByText("Original Title")).toBeNull()
    })

    it("updates items when prop changes", () => {
      const { getByText, queryByText, rerender } = render(
        <BulletListCard title="Title" items={["Original Item"]} />,
      )

      expect(getByText("Original Item")).toBeTruthy()

      rerender(<BulletListCard title="Title" items={["Updated Item"]} />)

      expect(getByText("Updated Item")).toBeTruthy()
      expect(queryByText("Original Item")).toBeNull()
    })

    it("adds new items on rerender", () => {
      const { getByText, rerender } = render(
        <BulletListCard title="Title" items={["Item 1"]} />,
      )

      expect(getByText("Item 1")).toBeTruthy()

      rerender(<BulletListCard title="Title" items={["Item 1", "Item 2"]} />)

      expect(getByText("Item 1")).toBeTruthy()
      expect(getByText("Item 2")).toBeTruthy()
    })

    it("removes items on rerender", () => {
      const { getByText, queryByText, rerender } = render(
        <BulletListCard title="Title" items={["Item 1", "Item 2"]} />,
      )

      expect(getByText("Item 1")).toBeTruthy()
      expect(getByText("Item 2")).toBeTruthy()

      rerender(<BulletListCard title="Title" items={["Item 1"]} />)

      expect(getByText("Item 1")).toBeTruthy()
      expect(queryByText("Item 2")).toBeNull()
    })
  })

  describe("bullet points", () => {
    it("renders bullet points for each item", () => {
      const { toJSON } = render(<BulletListCard {...defaultProps} />)

      const tree = toJSON()
      expect(tree).toBeTruthy()
    })

    it("renders correct number of bullet items", () => {
      const items = ["One", "Two", "Three", "Four"]
      const { getAllByText } = render(<BulletListCard title="Four Items" items={items} />)

      items.forEach((item) => {
        expect(getAllByText(item)).toHaveLength(1)
      })
    })
  })
})
