import { Linking } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useContactSupport } from "@app/hooks/use-contact-support"

const SUPPORT_EMAIL = "support@blink.sv"

const mockCopyToClipboard = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ supportEmailAddress: SUPPORT_EMAIL }),
}))

jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

describe("useContactSupport", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  })

  it("exposes the configured support email address", () => {
    const { result } = renderHook(() => useContactSupport())

    expect(result.current.supportEmailAddress).toBe(SUPPORT_EMAIL)
  })

  it("opens a mailto link to the support email address", async () => {
    const { result } = renderHook(() => useContactSupport())

    await result.current.openSupport()

    expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`)
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("opens a pre-filled mailto link with the encoded subject and body", async () => {
    const { result } = renderHook(() => useContactSupport())

    await result.current.composeSupport({
      subject: "Case 42",
      body: "Account ID: abc\nOk",
    })

    expect(Linking.openURL).toHaveBeenCalledWith(
      `mailto:${SUPPORT_EMAIL}?subject=Case%2042&body=Account%20ID%3A%20abc%0AOk`,
    )
  })

  it("copies the support address when opening the mailto link rejects (no mail app)", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no activity found"))
    const { result } = renderHook(() => useContactSupport())

    await result.current.openSupport()

    expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`)
    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: SUPPORT_EMAIL })
  })

  it("copies the support address when a pre-filled mailto rejects too", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no activity found"))
    const { result } = renderHook(() => useContactSupport())

    await result.current.composeSupport({ subject: "s", body: "b" })

    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: SUPPORT_EMAIL })
  })
})
