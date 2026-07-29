import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"

const mockCardDefaultBg = "#1d1d1d"
const mockCardSelectedBg = "#2B2B2B"
const mockPrimary = "#fc5805"

jest.mock("@rn-vui/themed", () => ({
  makeStyles:
    (fn: (args: { colors: Record<string, string> }) => Record<string, object>) => () =>
      fn({
        colors: {
          primary: "#fc5805",
          grey2: "#949494",
          grey5: "#1d1d1d",
          grey6: "#2B2B2B",
          black: "#000",
        },
      }),
  Text: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => React.createElement("View", { testID: "galoy-icon" }),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

const options: OptionCard[] = [
  {
    key: "first",
    icon: "cloud",
    title: "First option",
    description: "First description",
    testID: "first-option",
  },
  {
    key: "second",
    icon: "key-outline",
    title: "Second option",
    description: "Second description",
    testID: "second-option",
  },
]

describe("OptionCardGroup", () => {
  it("renders every option's title and description", () => {
    const { getByText } = render(
      <OptionCardGroup options={options} selectedKey={null} onSelect={jest.fn()} />,
    )

    expect(getByText("First option")).toBeTruthy()
    expect(getByText("First description")).toBeTruthy()
    expect(getByText("Second option")).toBeTruthy()
    expect(getByText("Second description")).toBeTruthy()
  })

  it("calls onSelect with the tapped option's key", () => {
    const onSelect = jest.fn()
    const { getByTestId } = render(
      <OptionCardGroup options={options} selectedKey={null} onSelect={onSelect} />,
    )

    fireEvent.press(getByTestId("second-option"))

    expect(onSelect).toHaveBeenCalledWith("second")
  })

  it("applies the default background to unselected cards", () => {
    const { getByTestId } = render(
      <OptionCardGroup options={options} selectedKey={null} onSelect={jest.fn()} />,
    )

    expect(getByTestId("first-option").props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: mockCardDefaultBg }),
      ]),
    )
  })

  it("highlights the selected card with the primary border and selected background", () => {
    const { getByTestId } = render(
      <OptionCardGroup options={options} selectedKey="first" onSelect={jest.fn()} />,
    )

    expect(getByTestId("first-option").props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: mockCardSelectedBg,
          borderColor: mockPrimary,
        }),
      ]),
    )
  })

  it("renders an option without a testID", () => {
    const untagged: OptionCard[] = [
      { key: "only", icon: "cloud", title: "Only", description: "No testID" },
    ]

    const { getByText } = render(
      <OptionCardGroup options={untagged} selectedKey={null} onSelect={jest.fn()} />,
    )

    expect(getByText("Only")).toBeTruthy()
  })
})
