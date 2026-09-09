import { Platform } from "react-native"

import { exportCsvFile } from "@app/utils/export-csv-file"

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="
const DEFAULT_PLATFORM_OS = Platform.OS

const mockSaveCsvToDownloads = jest.fn()
const mockShareCsvBase64 = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/utils/save-csv", () => ({
  saveCsvToDownloads: (...args: unknown[]) => mockSaveCsvToDownloads(...args),
}))

jest.mock("@app/utils/share-csv", () => ({
  shareCsvBase64: (...args: unknown[]) => mockShareCsvBase64(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

describe("exportCsvFile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveCsvToDownloads.mockResolvedValue("/mock/downloads/blink-transactions.csv")
    mockShareCsvBase64.mockResolvedValue(true)
  })

  afterEach(() => {
    Platform.OS = DEFAULT_PLATFORM_OS
  })

  it("downloads to the Downloads folder on Android instead of opening the share sheet", async () => {
    Platform.OS = "android"

    await expect(exportCsvFile(CSV_BASE64)).resolves.toBe("saved")

    expect(mockSaveCsvToDownloads).toHaveBeenCalledWith(CSV_BASE64)
    expect(mockShareCsvBase64).not.toHaveBeenCalled()
  })

  it("keeps the share sheet on iOS, where it is how a file is saved", async () => {
    Platform.OS = "ios"

    await expect(exportCsvFile(CSV_BASE64)).resolves.toBe("shared")

    expect(mockShareCsvBase64).toHaveBeenCalledWith(CSV_BASE64)
    expect(mockSaveCsvToDownloads).not.toHaveBeenCalled()
  })

  it("reports a dismissed share sheet as cancelled", async () => {
    Platform.OS = "ios"
    mockShareCsvBase64.mockResolvedValue(false)

    await expect(exportCsvFile(CSV_BASE64)).resolves.toBe("cancelled")
  })

  it("falls back to the share sheet when the Android write throws", async () => {
    Platform.OS = "android"
    mockSaveCsvToDownloads.mockRejectedValue(new Error("EACCES"))

    await expect(exportCsvFile(CSV_BASE64)).resolves.toBe("shared")

    expect(mockReportError).toHaveBeenCalled()
    expect(mockShareCsvBase64).toHaveBeenCalledWith(CSV_BASE64)
  })

  it("falls back to the share sheet when the storage grant is refused", async () => {
    Platform.OS = "android"
    mockSaveCsvToDownloads.mockResolvedValue(null)

    await expect(exportCsvFile(CSV_BASE64)).resolves.toBe("shared")

    expect(mockShareCsvBase64).toHaveBeenCalledWith(CSV_BASE64)
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
