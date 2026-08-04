import { createCustodialExportCsv } from "@app/custodial/adapters/export-csv"

const mockShareCsvBase64 = jest.fn()

jest.mock("@app/utils/share-csv", () => ({
  shareCsvBase64: (...args: unknown[]) => mockShareCsvBase64(...args),
}))

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="

describe("createCustodialExportCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShareCsvBase64.mockResolvedValue(true)
  })

  it("fetches the CSV for the given wallets and shares it", async () => {
    const fetchCsv = jest.fn().mockResolvedValue(CSV_BASE64)
    const exportCsv = createCustodialExportCsv(fetchCsv)

    await expect(exportCsv(["btc-1", "usd-1"])).resolves.toBe(true)

    expect(fetchCsv).toHaveBeenCalledWith(["btc-1", "usd-1"])
    expect(mockShareCsvBase64).toHaveBeenCalledWith(CSV_BASE64)
  })

  it("resolves false without sharing when the backend returns an empty CSV", async () => {
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(""))

    await expect(exportCsv(["btc-1"])).resolves.toBe(false)
    expect(mockShareCsvBase64).not.toHaveBeenCalled()
  })

  it("throws without sharing when the CSV field is missing from the response", async () => {
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(undefined))

    await expect(exportCsv(["btc-1"])).rejects.toThrow()
    expect(mockShareCsvBase64).not.toHaveBeenCalled()
  })

  it("passes a share-sheet dismissal through as false", async () => {
    mockShareCsvBase64.mockResolvedValue(false)
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(CSV_BASE64))

    await expect(exportCsv(["btc-1"])).resolves.toBe(false)
  })
})
