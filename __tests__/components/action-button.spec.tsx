import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { ActionButton } from "@app/components/action-button"

jest.mock("@rn-vui/themed", () => {
  return {
    Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
      <ReactNativeText {...props} />
    ),
    useTheme: () => ({
      theme: {
        colors: {
          primary: "primary",
          grey5: "grey5",
          grey6: "grey6",
          black: "black",
        },
      },
    }),
    makeStyles: () => () => ({ container: {}, pressed: {}, label: {} }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => {
  const { View: RNView } = jest.requireActual("react-native")
  return {
    GaloyIcon: ({ name }: { name: string }) => <RNView testID={`icon-${name}`} />,
  }
})

describe("ActionButton", () => {
  const defaultProps = {
    label: "Copy",
    icon: "copy-paste" as const,
    onPress: jest.fn(),
    accessibilityHint: "Copy to clipboard",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders label and icon", () => {
    const { getByText, getByTestId } = render(<ActionButton {...defaultProps} />)

    expect(getByText("Copy")).toBeTruthy()
    expect(getByTestId("icon-copy-paste")).toBeTruthy()
  })

  it("calls onPress when pressed", () => {
    const { getByText } = render(<ActionButton {...defaultProps} />)

    fireEvent.press(getByText("Copy"))

    expect(defaultProps.onPress).toHaveBeenCalledTimes(1)
  })

  it("sets accessibilityHint and role", () => {
    const { getByRole } = render(<ActionButton {...defaultProps} />)

    const button = getByRole("button")
    expect(button.props.accessibilityHint).toBe("Copy to clipboard")
  })

  it("renders different icons based on prop", () => {
    const { getByTestId } = render(
      <ActionButton {...defaultProps} icon="share" label="Share" />,
    )

    expect(getByTestId("icon-share")).toBeTruthy()
  })
})
