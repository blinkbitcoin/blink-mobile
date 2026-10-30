import { renderHook, waitFor } from "@testing-library/react-native"

import { useScreenSecurity } from "@app/hooks/use-screen-security"

const mockEnableScreenSecurity = jest.fn()
const mockDisableScreenSecurity = jest.fn()

jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: (...args: string[]) => mockEnableScreenSecurity(...args),
  disableScreenSecurity: () => mockDisableScreenSecurity(),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({
    theme: { colors: { black: "#000000" } },
  }),
}))

describe("useScreenSecurity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnableScreenSecurity.mockResolvedValue(undefined)
    mockDisableScreenSecurity.mockResolvedValue(undefined)
  })

  it("enables screen security on mount", () => {
    renderHook(() => useScreenSecurity())

    expect(mockEnableScreenSecurity).toHaveBeenCalledWith("#000000")
  })

  it("disables screen security on unmount", () => {
    const { unmount } = renderHook(() => useScreenSecurity())

    unmount()

    expect(mockDisableScreenSecurity).toHaveBeenCalled()
  })

  /** The enable is fire-and-forget; a native failure to install the guard must be
   *  reported, not leaked as an unhandled rejection while the screen renders its seed
   *  words unprotected. */
  it("reports a rejected enable instead of leaking an unhandled rejection", async () => {
    const failure = new Error("native failure")
    mockEnableScreenSecurity.mockRejectedValueOnce(failure)

    renderHook(() => useScreenSecurity())

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith("Enable screen security", failure),
    )
  })

  it("reports a rejected disable on unmount", async () => {
    const failure = new Error("native failure")
    mockDisableScreenSecurity.mockRejectedValueOnce(failure)

    const { unmount } = renderHook(() => useScreenSecurity())
    unmount()

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith("Disable screen security", failure),
    )
  })
})
