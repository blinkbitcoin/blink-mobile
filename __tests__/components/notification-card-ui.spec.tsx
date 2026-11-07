import * as React from "react"
import { Text as ReactNativeText, TouchableOpacity, View } from "react-native"
import { ReactTestRendererJSON } from "react-test-renderer"
import { render, fireEvent } from "@testing-library/react-native"

import { BulletinCarouselItemContext } from "@app/components/notifications/bulletin-carousel-context"
import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

loadLocale("en")

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

  it("styles the title with the themed bold preset so it outranks the body", () => {
    const { getByText } = render(<NotificationCardUI {...defaultProps} />)

    expect(getByText("Test Title").props).toMatchObject({ type: "p3", bold: true })
    expect(getByText("Test Body").props).toMatchObject({ type: "p3" })
    expect(getByText("Test Body").props.bold).toBeUndefined()
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

  it("renders an inert card without action: title and body but no touchable container", () => {
    const screen = render(<NotificationCardUI title="Test Title" text="Test Body" />)

    expect(screen.getByText("Test Title")).toBeTruthy()
    expect(screen.getByText("Test Body")).toBeTruthy()
    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeNull()
  })

  it("renders no button without action, even when a buttonLabel is passed", () => {
    const { queryByTestId } = render(
      <NotificationCardUI title="Test Title" text="Test Body" buttonLabel="Click me" />,
    )

    expect(queryByTestId("primary-button")).toBeNull()
  })

  it("keeps the touchable container when action is present", () => {
    const screen = render(<NotificationCardUI {...defaultProps} />)

    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeTruthy()
  })
})

/** A long body is cut to 3 lines plus "Read more" once it measures over 4 lines. */
describe("NotificationCardUI with a long body", () => {
  const LONG = "A body long enough to need more than four lines on a small phone."

  const card = (
    props: Partial<React.ComponentProps<typeof NotificationCardUI>> = {},
    isActive = true,
  ) => (
    <TypesafeI18n locale="en">
      <BulletinCarouselItemContext.Provider value={{ isActive }}>
        <NotificationCardUI {...defaultProps} text={LONG} {...props} />
      </BulletinCarouselItemContext.Provider>
    </TypesafeI18n>
  )

  /** The hidden copy reports how many lines the full body takes. */
  const measureLines = (screen: ReturnType<typeof render>, count: number) =>
    fireEvent(
      screen.getAllByText(LONG, { includeHiddenElements: true })[0],
      "textLayout",
      { nativeEvent: { lines: Array.from({ length: count }, () => ({})) } },
    )

  const visibleBody = (screen: ReturnType<typeof render>) => screen.getByText(LONG)

  it("shows a body of 4 lines in full, with no Read more", () => {
    const screen = render(card())
    measureLines(screen, 4)

    expect(visibleBody(screen).props.numberOfLines).toBeUndefined()
    expect(screen.queryByText("Read more")).toBeNull()
  })

  it("cuts a body over 4 lines to 3, ending in an ellipsis, with Read more under it", () => {
    const screen = render(card())
    measureLines(screen, 5)

    expect(visibleBody(screen).props).toMatchObject({
      numberOfLines: 3,
      ellipsizeMode: "tail",
    })
    expect(screen.getByRole("button", { name: "Read more" })).toBeTruthy()
  })

  it("keeps the measuring copy away from screen readers, which read the full body", () => {
    const screen = render(card())
    measureLines(screen, 5)

    expect(screen.getAllByText(LONG)).toHaveLength(1)
    expect(visibleBody(screen).props.accessibilityLabel).toBe(LONG)
  })

  it("expands on Read more", () => {
    const action = jest.fn(() => Promise.resolve())
    const screen = render(card({ action }))
    measureLines(screen, 5)

    fireEvent.press(screen.getByText("Read more"))

    expect(visibleBody(screen).props.numberOfLines).toBeUndefined()
    expect(screen.queryByText("Read more")).toBeNull()
    expect(action).not.toHaveBeenCalled()
  })

  /** While cut short, a tap anywhere reads more; only the button opens the link. */
  it("expands on a tap on the card instead of opening the link", () => {
    const action = jest.fn(() => Promise.resolve())
    const screen = render(card({ action }))
    measureLines(screen, 5)

    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeNull()
    /** Not a button for screen readers, which reach "Read more" on its own. */
    const root = screen.toJSON() as ReactTestRendererJSON
    expect(root.props.accessible).toBe(false)
    expect(root.props.onClick).toEqual(expect.any(Function))
    fireEvent.press(screen.getByText("Test Title"))

    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByText("Read more")).toBeNull()
  })

  it("still opens the link from the action button while cut short", () => {
    const action = jest.fn(() => Promise.resolve())
    const screen = render(card({ action, buttonLabel: "Open" }))
    measureLines(screen, 5)

    fireEvent.press(screen.getByTestId("primary-button"))

    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Read more")).toBeTruthy()
  })

  it("behaves as before once expanded: a tap opens the link", () => {
    const action = jest.fn(() => Promise.resolve())
    const screen = render(card({ action }))
    measureLines(screen, 5)
    fireEvent.press(screen.getByText("Read more"))

    fireEvent.press(screen.getByText("Test Title"))

    expect(action).toHaveBeenCalledTimes(1)
  })

  it("expands a card without a link, which stays a plain card afterwards", () => {
    const screen = render(card({ action: undefined }))
    measureLines(screen, 5)

    fireEvent.press(screen.getByText("Test Title"))

    expect(screen.queryByText("Read more")).toBeNull()
    expect((screen.toJSON() as ReactTestRendererJSON).props.onClick).toBeUndefined()
    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeNull()
  })

  it("folds back when swiped out of view", () => {
    const screen = render(card())
    measureLines(screen, 5)
    fireEvent.press(screen.getByText("Read more"))

    screen.rerender(card({}, false))
    screen.rerender(card({}, true))

    expect(visibleBody(screen).props.numberOfLines).toBe(3)
    expect(screen.getByText("Read more")).toBeTruthy()
  })
})
