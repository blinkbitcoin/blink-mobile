import React from "react"
import { BackHandler, Text as RNText } from "react-native"
import { act, render, screen } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

/**
 * The screen on a real stack: a native stack keeps a covered route mounted, so
 * the hardware back must follow focus, not mount. The sibling spec stubs focus
 * and covers what the handler does; this one covers when it is installed.
 */

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual<object>("react-native-reanimated"),
  __esModule: true,
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => true,
  withTiming: (value: number) => value,
  withRepeat: (value: number) => value,
  cancelAnimation: jest.fn(),
}))

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Line: () => null,
}))

/** The Android back, as React Native raises it: the latest handler first, until
 *  one takes it. The navigator's own is among them. */
type HardwareBackHandler = () => boolean | null | undefined
const hardwareBackHandlers: HardwareBackHandler[] = []
jest
  .spyOn(BackHandler, "addEventListener")
  .mockImplementation((_event, handler: HardwareBackHandler) => {
    hardwareBackHandlers.push(handler)
    return {
      remove: () => {
        const index = hardwareBackHandlers.lastIndexOf(handler)
        if (index !== -1) hardwareBackHandlers.splice(index, 1)
      },
    }
  })
const pressHardwareBack = () =>
  act(() => {
    ;[...hardwareBackHandlers].reverse().some((handler) => handler())
  })

// eslint-disable-next-line import/first
import { BusyStateScreen, type BusyStateError } from "@app/components/busy-state"

loadLocale("en")

type ParamList = { Start: undefined; Busy: undefined; Covering: undefined }
const Stack = createNativeStackNavigator<ParamList>()
const navigationRef = createNavigationContainerRef<ParamList>()

/** Busy is pushed after the navigator is up, as in the app, so its handler is
 *  installed after the navigator's and is asked first. */
const renderOnStack = (error?: BusyStateError) => {
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator>
            <Stack.Screen name="Start">{() => <RNText>start</RNText>}</Stack.Screen>
            <Stack.Screen
              name="Busy"
              options={{ headerShown: false, gestureEnabled: false }}
            >
              {() => (
                <BusyStateScreen
                  icon1={<RNText>icon1</RNText>}
                  icon2={<RNText>icon2</RNText>}
                  title="Working"
                  completion={{ kind: "pending", done: false }}
                  onDone={jest.fn()}
                  error={error}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Covering">
              {() => <RNText>covering route</RNText>}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </TypesafeI18n>
    </ThemeProvider>,
  )
  act(() => {
    navigationRef.navigate("Busy")
  })
}

const cover = () =>
  act(() => {
    navigationRef.navigate("Covering")
  })

describe("BusyStateScreen hardware back on a stack", () => {
  beforeEach(() => {
    hardwareBackHandlers.length = 0
  })

  it("routes back to onBack while focused", () => {
    const onBack = jest.fn()
    renderOnStack({ title: "Failed", onBack })

    pressHardwareBack()

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("lets the covering route have back while it stays mounted underneath", () => {
    const onBack = jest.fn()
    renderOnStack({ title: "Failed", onBack })

    cover()
    expect(screen.getByText("covering route")).toBeTruthy()
    expect(screen.getByText("Failed", { includeHiddenElements: true })).toBeTruthy()

    pressHardwareBack()

    expect(onBack).not.toHaveBeenCalled()
    expect(navigationRef.getCurrentRoute()?.name).toBe("Busy")
  })

  it("does not swallow back for the covering route while busy", () => {
    renderOnStack()

    cover()
    pressHardwareBack()

    expect(navigationRef.getCurrentRoute()?.name).toBe("Busy")
  })

  it("takes back again once its route is focused again", () => {
    const onClose = jest.fn()
    renderOnStack({ title: "Failed", onClose })

    cover()
    pressHardwareBack()
    pressHardwareBack()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(navigationRef.getCurrentRoute()?.name).toBe("Busy")
  })
})
