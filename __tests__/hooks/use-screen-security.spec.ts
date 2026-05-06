import { renderHook } from "@testing-library/react-native"

import { useScreenSecurity } from "@app/hooks/use-screen-security"

const mockEnableScreenSecurity = jest.fn()
const mockDisableScreenSecurity = jest.fn()

jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: (...args: string[]) => mockEnableScreenSecurity(...args),
  disableScreenSecurity: () => mockDisableScreenSecurity(),
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
})
