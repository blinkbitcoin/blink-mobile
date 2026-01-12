import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { PercentageSelector } from "@app/components/percentage-selector/percentage-selector"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "primary",
        grey5: "grey5",
      },
    },
  }),
  makeStyles: () => () => ({
    row: {},
    chip: {},
    chipDisabled: {},
    chipText: {},
  }),
}))

describe("PercentageSelector", () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders default percentage options", () => {
    const { getByText } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={null}
        onSelect={mockOnSelect}
      />,
    )

    expect(getByText("25%")).toBeTruthy()
    expect(getByText("50%")).toBeTruthy()
    expect(getByText("75%")).toBeTruthy()
    expect(getByText("100%")).toBeTruthy()
  })

  it("renders custom percentage options", () => {
    const customOptions = [10, 20, 30]
    const { getByText, queryByText } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={null}
        onSelect={mockOnSelect}
        options={customOptions}
      />,
    )

    expect(getByText("10%")).toBeTruthy()
    expect(getByText("20%")).toBeTruthy()
    expect(getByText("30%")).toBeTruthy()
    expect(queryByText("25%")).toBeNull()
  })

  it("calls onSelect when a percentage button is pressed", () => {
    const { getByText } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={null}
        onSelect={mockOnSelect}
      />,
    )

    fireEvent.press(getByText("50%"))

    expect(mockOnSelect).toHaveBeenCalledWith(50)
    expect(mockOnSelect).toHaveBeenCalledTimes(1)
  })

  it("does not call onSelect when isLocked is true", () => {
    const { getByText } = render(
      <PercentageSelector
        isLocked={true}
        loadingPercent={null}
        onSelect={mockOnSelect}
      />,
    )

    fireEvent.press(getByText("50%"))

    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it("shows ActivityIndicator when loadingPercent matches option", () => {
    const { getByTestId, queryByText } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={75}
        onSelect={mockOnSelect}
        testIdPrefix="test"
      />,
    )

    expect(getByTestId("test-75%")).toBeTruthy()
    expect(queryByText("75%")).toBeNull()
  })

  it("shows percentage text when not loading", () => {
    const { getByText } = render(
      <PercentageSelector isLocked={false} loadingPercent={25} onSelect={mockOnSelect} />,
    )

    expect(getByText("50%")).toBeTruthy()
    expect(getByText("75%")).toBeTruthy()
    expect(getByText("100%")).toBeTruthy()
  })

  it("uses default testIdPrefix when not provided", () => {
    const { getByTestId } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={null}
        onSelect={mockOnSelect}
      />,
    )

    expect(getByTestId("convert-25%")).toBeTruthy()
  })

  it("uses custom testIdPrefix when provided", () => {
    const { getByTestId } = render(
      <PercentageSelector
        isLocked={false}
        loadingPercent={null}
        onSelect={mockOnSelect}
        testIdPrefix="custom"
      />,
    )

    expect(getByTestId("custom-25%")).toBeTruthy()
  })
})
