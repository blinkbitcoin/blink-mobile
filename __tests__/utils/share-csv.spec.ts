import { Platform } from "react-native"

import { shareCsvBase64 } from "@app/utils/share-csv"

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="
const DEFAULT_PLATFORM_OS = Platform.OS

const mockShareOpen = jest.fn()

jest.mock("react-native-share", () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockShareOpen(...args) },
}))

describe("shareCsvBase64", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShareOpen.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    Platform.OS = DEFAULT_PLATFORM_OS
  })

  it("shares the encoded payload as a csv data url", async () => {
    await shareCsvBase64(CSV_BASE64)

    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "blink-transactions",
        url: `data:text/csv;base64,${CSV_BASE64}`,
        type: "text/csv",
        failOnCancel: false,
      }),
    )
  })

  it("resolves true when the share sheet completes", async () => {
    await expect(shareCsvBase64(CSV_BASE64)).resolves.toBe(true)
  })

  it("resolves false without rejecting when the user dismisses the share sheet", async () => {
    mockShareOpen.mockResolvedValue({ success: false, dismissedAction: true })

    await expect(shareCsvBase64(CSV_BASE64)).resolves.toBe(false)
  })

  it("names the file with a single .csv extension on iOS", async () => {
    Platform.OS = "ios"

    await shareCsvBase64(CSV_BASE64)

    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "blink-transactions.csv" }),
    )
  })

  it("avoids a duplicate .csv extension on Android", async () => {
    Platform.OS = "android"

    await shareCsvBase64(CSV_BASE64)

    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "blink-transactions" }),
    )
  })
})
