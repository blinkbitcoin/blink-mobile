import { Linking } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useContactSupport } from "@app/hooks/use-contact-support"

const SUPPORT_EMAIL = "support@blink.sv"

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ supportEmailAddress: SUPPORT_EMAIL }),
}))

describe("useContactSupport", () => {
  it("exposes the configured support email address", () => {
    const { result } = renderHook(() => useContactSupport())

    expect(result.current.supportEmailAddress).toBe(SUPPORT_EMAIL)
  })

  it("opens a mailto link to the support email address", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
    const { result } = renderHook(() => useContactSupport())

    result.current.openSupport()

    expect(openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`)
  })

  it("opens a pre-filled mailto link with the encoded subject and body", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
    const { result } = renderHook(() => useContactSupport())

    result.current.composeSupport({ subject: "Case 42", body: "Account ID: abc\nOk" })

    expect(openURL).toHaveBeenCalledWith(
      `mailto:${SUPPORT_EMAIL}?subject=Case%2042&body=Account%20ID%3A%20abc%0AOk`,
    )
  })
})
