import { Linking } from "react-native"

import { openExternalUrl, openWhatsApp } from "@app/utils/external"

const mockOpen = jest.fn()

jest.mock("react-native-inappbrowser-reborn", () => ({
  default: { open: (...args: readonly unknown[]) => mockOpen(...args) },
  __esModule: true,
}))

jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

describe("openExternalUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("opens URL in InAppBrowser", async () => {
    mockOpen.mockResolvedValue(undefined)
    await openExternalUrl("https://example.com")

    expect(mockOpen).toHaveBeenCalledWith("https://example.com")
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it("falls back to Linking when InAppBrowser fails", async () => {
    mockOpen.mockRejectedValue(new Error("unavailable"))
    await openExternalUrl("https://example.com")

    expect(mockOpen).toHaveBeenCalledWith("https://example.com")
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
  })
})

describe("openWhatsApp", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("opens whatsapp URL with encoded phone and message", async () => {
    await openWhatsApp("+1234567890", "Hello World")

    expect(Linking.openURL).toHaveBeenCalledWith(
      "whatsapp://send?phone=%2B1234567890&text=Hello%20World",
    )
  })
})
