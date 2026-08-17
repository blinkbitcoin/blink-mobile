import React from "react"
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import {
  headerBackControl,
  InvisibleBackButton,
} from "@app/components/header-back-control/header-back-control"

import {
  DefaultTheme as navigationDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native"
import { NativeStackHeaderBackProps } from "@react-navigation/native-stack"

/* Guards the contract documented on headerBackControl: what `headerLeft` receives must
 * be a render function that calls no hooks of its own (#4176). */

const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
}))

const BACK_BUTTON_LABEL = "Go back"

const originalPlatformOS = Platform.OS

const headerProps: NativeStackHeaderBackProps = { canGoBack: true }

const backButtonStyle = (button: { props: { style?: StyleProp<ViewStyle> } }) =>
  StyleSheet.flatten(button.props.style)

/* HeaderBackButton reads react-navigation's own theme, which normally comes from the
 * NavigationContainer the header lives in. */
const renderHeaderLeft = (element: React.ReactNode) =>
  render(
    <NavigationThemeProvider value={navigationDefaultTheme}>
      <ThemeProvider theme={theme}>{element}</ThemeProvider>
    </NavigationThemeProvider>,
  )

describe("headerBackControl", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    })
  })

  it("returns an element instead of invoking the button component", () => {
    const element = headerBackControl()(headerProps)

    expect(React.isValidElement(element)).toBe(true)
  })

  it("goes back when the themed button is pressed", async () => {
    const { getByLabelText } = renderHeaderLeft(headerBackControl()(headerProps))

    fireEvent.press(getByLabelText(BACK_BUTTON_LABEL))

    // HeaderBackButton defers its onPress to the next frame.
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
  })

  it("renders the invisible placeholder when going back is not allowed", () => {
    const element = headerBackControl({ canGoBack: false })(headerProps)

    expect((element as React.ReactElement).type).toBe(InvisibleBackButton)
  })

  it("keeps the placeholder out of the accessibility tree", () => {
    const { queryByLabelText } = renderHeaderLeft(
      headerBackControl({ canGoBack: false })(headerProps),
    )

    // It only holds the header slot, so a screen reader must never announce it.
    expect(queryByLabelText(BACK_BUTTON_LABEL)).toBeNull()
  })

  /* Both cases assert the correction this component owns, not the final on-screen
   * position: HeaderBackButton's own platform styles are frozen when its module loads,
   * so they stay on the iOS branch whatever this test does to Platform. */
  it("adds no inset correction on iOS", () => {
    const { getByLabelText } = renderHeaderLeft(headerBackControl()(headerProps))

    expect(backButtonStyle(getByLabelText(BACK_BUTTON_LABEL))).toMatchObject({
      marginLeft: 0,
    })
  })

  it("pulls the button left on Android, where the native header adds its own inset", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })

    const { getByLabelText } = renderHeaderLeft(headerBackControl()(headerProps))

    expect(backButtonStyle(getByLabelText(BACK_BUTTON_LABEL))).toMatchObject({
      marginLeft: -10,
    })
  })
})
