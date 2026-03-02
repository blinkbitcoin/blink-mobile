import * as React from "react"
import { Text as ReactNativeText, TouchableOpacity, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"

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
          grey2: "grey2",
          black: "black",
          white: "white",
        },
      },
    }),
    makeStyles: () => () => ({}),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ name, onPress }: { name: string; onPress?: () => void }) => (
    <TouchableOpacity testID={`icon-button-${name}`} onPress={onPress} />
  ),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <TouchableOpacity testID="primary-button" onPress={onPress}>
      <ReactNativeText>{title}</ReactNativeText>
    </TouchableOpacity>
  ),
}))

const defaultProps = {
  title: "Test Title",
  text: "Test Body",
  action: jest.fn(() => Promise.resolve()),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("NotificationCardUI", () => {
  it("renders title and body", () => {
    const { getByText } = render(<NotificationCardUI {...defaultProps} />)

    expect(getByText("Test Title")).toBeTruthy()
    expect(getByText("Test Body")).toBeTruthy()
  })

  it("renders icon when provided", () => {
    const { queryByTestId } = render(
      <NotificationCardUI {...defaultProps} icon="warning" />,
    )

    expect(queryByTestId("galoy-icon-warning")).toBeTruthy()
  })

  it("does not render icon when not provided", () => {
    const { queryByTestId } = render(<NotificationCardUI {...defaultProps} />)

    expect(queryByTestId("galoy-icon-warning")).toBeNull()
  })

  it("renders close button when dismissAction is provided", () => {
    const dismissAction = jest.fn()
    const { queryByTestId } = render(
      <NotificationCardUI {...defaultProps} dismissAction={dismissAction} />,
    )

    expect(queryByTestId("icon-button-close")).toBeTruthy()
  })

  it("does not render close button when dismissAction is not provided", () => {
    const { queryByTestId } = render(<NotificationCardUI {...defaultProps} />)

    expect(queryByTestId("icon-button-close")).toBeNull()
  })

  it("renders button with label when buttonLabel is provided", () => {
    const { getByText, queryByTestId } = render(
      <NotificationCardUI {...defaultProps} buttonLabel="Learn more" />,
    )

    expect(queryByTestId("primary-button")).toBeTruthy()
    expect(getByText("Learn more")).toBeTruthy()
  })

  it("does not render button when buttonLabel is not provided", () => {
    const { queryByTestId } = render(<NotificationCardUI {...defaultProps} />)

    expect(queryByTestId("primary-button")).toBeNull()
  })

  it("calls action when button is pressed", () => {
    const action = jest.fn(() => Promise.resolve())
    const { getByTestId } = render(
      <NotificationCardUI {...defaultProps} action={action} buttonLabel="Click me" />,
    )

    fireEvent.press(getByTestId("primary-button"))
    expect(action).toHaveBeenCalled()
  })

  it("calls dismissAction when close button is pressed", () => {
    const dismissAction = jest.fn()
    const { getByTestId } = render(
      <NotificationCardUI {...defaultProps} dismissAction={dismissAction} />,
    )

    fireEvent.press(getByTestId("icon-button-close"))
    expect(dismissAction).toHaveBeenCalled()
  })

  it("renders loading state", () => {
    const { queryByText, queryByTestId } = render(
      <NotificationCardUI {...defaultProps} loading={true} />,
    )

    expect(queryByText("Test Title")).toBeNull()
    expect(queryByTestId("primary-button")).toBeNull()
  })

  it("renders button and icon together", () => {
    const { getByText, queryByTestId } = render(
      <NotificationCardUI {...defaultProps} icon="bell" buttonLabel="Go to settings" />,
    )

    expect(queryByTestId("galoy-icon-bell")).toBeTruthy()
    expect(queryByTestId("primary-button")).toBeTruthy()
    expect(getByText("Go to settings")).toBeTruthy()
  })
})
