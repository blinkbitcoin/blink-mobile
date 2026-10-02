import React, { PropsWithChildren } from "react"

import { renderHook } from "@testing-library/react-native"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { dark, light } from "@app/rne-theme/colors"

import { flushEffects } from "../helpers/flush-effects"

const mockInitSettings = jest.fn()
const mockRegister = jest.fn()
const mockUnregister = jest.fn()
jest.mock("react-native-screenguard", () => ({
  initSettings: (...args: readonly unknown[]) => mockInitSettings(...args),
  register: (...args: readonly unknown[]) => mockRegister(...args),
  unregister: (...args: readonly unknown[]) => mockUnregister(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

type ThemeMode = "light" | "dark"
let mode: ThemeMode = "light"

/** Read on every render, so flipping `mode` and re-rendering is a theme change the
 *  hook sees through the real provider, the way automatic dark mode delivers it. */
const ThemedWrapper: React.FC<PropsWithChildren> = ({ children }) => (
  <ThemeProvider theme={createTheme({ lightColors: light, darkColors: dark, mode })}>
    {children}
  </ThemeProvider>
)

const deferred = () => {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/**
 * The hook and gate specs mock the manager, so this is the one place a theme flip
 * runs through the real one: the lease the effect releases and re-acquires, the
 * manager's color-change branch, and the state the gate acts on.
 */
describe("useScreenSecurity through the real screen-guard manager", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mode = "light"
    mockInitSettings.mockResolvedValue(undefined)
    mockRegister.mockResolvedValue(undefined)
    mockUnregister.mockResolvedValue(undefined)
  })

  /** The flip lands while the first registration is still in flight. When that
   *  registration then succeeds it carries the old color, and the new lease must not
   *  be reported active on it: the gate would mount the content and the manager would
   *  pull the guard down under it to apply the new color. */
  it("keeps the content hidden across a theme flip until the guard carries the new color", async () => {
    const pendingLight = deferred()
    const pendingDark = deferred()
    mockRegister
      .mockReturnValueOnce(pendingLight.promise)
      .mockReturnValueOnce(pendingDark.promise)

    const { result, rerender, unmount } = renderHook(() => useScreenSecurity(), {
      wrapper: ThemedWrapper,
    })
    await flushEffects()
    expect(result.current).toBe("activating")
    expect(mockRegister).toHaveBeenLastCalledWith({ backgroundColor: light.black })

    mode = "dark"
    rerender({})
    pendingLight.resolve()
    await flushEffects()

    // The stale-color registration landed and was brought down; nothing may show
    // until the dark one is up.
    expect(result.current).toBe("activating")
    expect(mockUnregister).toHaveBeenCalledTimes(1)
    expect(mockRegister).toHaveBeenLastCalledWith({ backgroundColor: dark.black })

    pendingDark.resolve()
    await flushEffects()
    expect(result.current).toBe("active")

    unmount()
    await flushEffects()
    expect(mockUnregister).toHaveBeenCalledTimes(2)
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
