import { renderHook, act } from "@testing-library/react-native"
import { Platform } from "react-native"
import RNFS from "react-native-fs"

import { useExportTransactionsCsv } from "@app/custodial/hooks/use-export-transactions-csv"
import { CsvExportOutcome } from "@app/utils/export-csv-file"

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="
const DEFAULT_PLATFORM_OS = Platform.OS

const mockFetchCsvTransactions = jest.fn()
const mockShareOpen = jest.fn()

jest.mock("react-native-share", () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockShareOpen(...args) },
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useExportCsvSettingLazyQuery: () => [mockFetchCsvTransactions, { loading: false }],
}))

const csvResponse = {
  data: { me: { defaultAccount: { csvTransactions: CSV_BASE64 } } },
}

describe("useExportTransactionsCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchCsvTransactions.mockResolvedValue(csvResponse)
    mockShareOpen.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    Platform.OS = DEFAULT_PLATFORM_OS
  })

  it("fetches the CSV for the given wallets and shares the encoded payload", async () => {
    const { result } = renderHook(() => useExportTransactionsCsv())

    await act(async () => {
      await result.current.exportCsv(["btc-1", "usd-1"])
    })

    expect(mockFetchCsvTransactions).toHaveBeenCalledWith({
      variables: { walletIds: ["btc-1", "usd-1"] },
    })
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "blink-transactions",
        url: `data:text/csv;base64,${CSV_BASE64}`,
        type: "text/csv",
        failOnCancel: false,
      }),
    )
  })

  it("resolves shared when the share sheet completes", async () => {
    const { result } = renderHook(() => useExportTransactionsCsv())

    let outcome: CsvExportOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportCsv(["btc-1"])
    })

    expect(outcome).toBe("shared")
  })

  it("resolves cancelled without rejecting when the user dismisses the share sheet", async () => {
    mockShareOpen.mockResolvedValue({ success: false, dismissedAction: true })
    const { result } = renderHook(() => useExportTransactionsCsv())

    let outcome: CsvExportOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportCsv(["btc-1"])
    })

    expect(outcome).toBe("cancelled")
  })

  it("names the file with a single .csv extension on iOS", async () => {
    Platform.OS = "ios"
    const { result } = renderHook(() => useExportTransactionsCsv())

    await act(async () => {
      await result.current.exportCsv(["btc-1"])
    })

    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "blink-transactions.csv" }),
    )
  })

  it("downloads to the Downloads folder instead of sharing on Android", async () => {
    Platform.OS = "android"
    const { result } = renderHook(() => useExportTransactionsCsv())

    let outcome: CsvExportOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportCsv(["btc-1"])
    })

    expect(outcome).toBe("saved")
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      "/mock/downloads/blink-transactions.csv",
      CSV_BASE64,
      "base64",
    )
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("throws and does not share when the CSV field is missing from the response", async () => {
    mockFetchCsvTransactions.mockResolvedValue({ data: undefined })
    const { result } = renderHook(() => useExportTransactionsCsv())

    await expect(result.current.exportCsv([])).rejects.toThrow()
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("resolves empty without sharing when the backend returns an empty CSV", async () => {
    mockFetchCsvTransactions.mockResolvedValue({
      data: { me: { defaultAccount: { csvTransactions: "" } } },
    })
    const { result } = renderHook(() => useExportTransactionsCsv())

    let outcome: CsvExportOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportCsv(["btc-1"])
    })

    expect(outcome).toBe("empty")
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("exposes the query loading state", () => {
    const { result } = renderHook(() => useExportTransactionsCsv())

    expect(result.current.loading).toBe(false)
  })
})
