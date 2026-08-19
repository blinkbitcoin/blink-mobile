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

/* Everything but useNavigation stays real, which is what lets these tests render
 * react-navigation's own ThemeProvider. A jest.spyOn on the module would be narrower
 * still, but react-navigation v7 ships ESM only: its exports transpile to
 * non-configurable getters and spying on one throws "Cannot redefine property". */
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
const withProviders = (element: React.ReactNode) => (
  <NavigationThemeProvider value={navigationDefaultTheme}>
    <ThemeProvider theme={theme}>{element}</ThemeProvider>
  </NavigationThemeProvider>
)

const renderHeaderLeft = (element: React.ReactNode) => render(withProviders(element))

/* Stands in for native-stack's useHeaderConfigProps: it calls hooks of its own and then
 * invokes `headerLeft` inline in the same body, which is what makes a hook called by the
 * render function land on this fiber. */
const HeaderConfigHost = ({
  headerLeft,
}: {
  headerLeft: (props: NativeStackHeaderBackProps) => React.ReactNode
}) => {
  React.useState(0)

  return <>{headerLeft(headerProps)}</>
}

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

  /* The crash #4176 fixed: the KYC webview (webview.tsx) and the account-delete flow
   * (delete.tsx) both hand `setOptions` a headerLeft that calls no hooks, so whatever this
   * control puts there first must not call any either. */
  it("survives a screen replacing the header with a hookless render", () => {
    const { rerender } = render(
      withProviders(<HeaderConfigHost headerLeft={headerBackControl()} />),
    )

    expect(() =>
      rerender(withProviders(<HeaderConfigHost headerLeft={() => null} />)),
    ).not.toThrow()
  })

  it("keeps going back allowed when the route carries no canGoBack param", () => {
    const { getByLabelText } = renderHeaderLeft(
      headerBackControl({ canGoBack: undefined })(headerProps),
    )

    expect(getByLabelText(BACK_BUTTON_LABEL)).toBeTruthy()
  })

  /* The onboarding screens flip this through setParams while the screen stays mounted
   * (root-navigator.tsx:993, :1001), so the header has to swap controls mid-life. */
  it("drops the back button when the route turns canGoBack off", () => {
    const { queryByLabelText, rerender } = render(
      withProviders(<HeaderConfigHost headerLeft={headerBackControl()} />),
    )

    rerender(
      withProviders(
        <HeaderConfigHost headerLeft={headerBackControl({ canGoBack: false })} />,
      ),
    )

    expect(queryByLabelText(BACK_BUTTON_LABEL)).toBeNull()
  })

  it("passes the header's own props through to the button", () => {
    const { getByLabelText } = renderHeaderLeft(
      headerBackControl()({ ...headerProps, label: "Settings" }),
    )

    // HeaderBackButton builds its accessibility label from the one the header supplies.
    expect(getByLabelText("Settings, back")).toBeTruthy()
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
