import { Linking } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useContactSupport } from "@app/hooks/use-contact-support"

const SUPPORT_EMAIL = "feedback@blink.sv"

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feedbackEmailAddress: SUPPORT_EMAIL }),
}))

describe("useContactSupport", () => {
  it("exposes the configured support email address", () => {
    const { result } = renderHook(() => useContactSupport())

    expect(result.current.feedbackEmailAddress).toBe(SUPPORT_EMAIL)
  })

  it("opens a mailto link to the support email address", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
    const { result } = renderHook(() => useContactSupport())

    result.current.openSupport()

    expect(openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`)
  })
})
