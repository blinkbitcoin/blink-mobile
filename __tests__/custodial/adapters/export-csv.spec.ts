import { createCustodialExportCsv } from "@app/custodial/adapters/export-csv"

const mockExportCsvFile = jest.fn()

jest.mock("@app/utils/export-csv-file", () => ({
  exportCsvFile: (...args: unknown[]) => mockExportCsvFile(...args),
}))

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="

describe("createCustodialExportCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExportCsvFile.mockResolvedValue("shared")
  })

  it("fetches the CSV for the given wallets and delivers it", async () => {
    const fetchCsv = jest.fn().mockResolvedValue(CSV_BASE64)
    const exportCsv = createCustodialExportCsv(fetchCsv)

    await expect(exportCsv(["btc-1", "usd-1"])).resolves.toBe("shared")

    expect(fetchCsv).toHaveBeenCalledWith(["btc-1", "usd-1"])
    expect(mockExportCsvFile).toHaveBeenCalledWith(CSV_BASE64)
  })

  it("resolves empty without delivering when the backend returns an empty CSV", async () => {
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(""))

    await expect(exportCsv(["btc-1"])).resolves.toBe("empty")
    expect(mockExportCsvFile).not.toHaveBeenCalled()
  })

  it("throws without delivering when the CSV field is missing from the response", async () => {
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(undefined))

    await expect(exportCsv(["btc-1"])).rejects.toThrow()
    expect(mockExportCsvFile).not.toHaveBeenCalled()
  })

  it("passes an Android download through as saved", async () => {
    mockExportCsvFile.mockResolvedValue("saved")
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(CSV_BASE64))

    await expect(exportCsv(["btc-1"])).resolves.toBe("saved")
  })

  it("passes a share-sheet dismissal through as cancelled", async () => {
    mockExportCsvFile.mockResolvedValue("cancelled")
    const exportCsv = createCustodialExportCsv(jest.fn().mockResolvedValue(CSV_BASE64))

    await expect(exportCsv(["btc-1"])).resolves.toBe("cancelled")
  })
})
