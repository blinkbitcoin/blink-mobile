// eslint-disable-next-line react-native/split-platform-components
import { PermissionsAndroid, Platform } from "react-native"
import RNFS from "react-native-fs"

import { saveCsvToDownloads } from "@app/utils/save-csv"

const CSV_BASE64 = "Y3N2LWNvbnRlbnQ="
const DEFAULT_PLATFORM_VERSION = Platform.Version

const mockRequestPermission = jest.spyOn(PermissionsAndroid, "request")

const setAndroidVersion = (version: number) => {
  Object.defineProperty(Platform, "Version", { value: version, configurable: true })
}

describe("saveCsvToDownloads", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setAndroidVersion(34)
    ;(RNFS.exists as jest.Mock).mockResolvedValue(false)
    ;(RNFS.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(RNFS.scanFile as jest.Mock).mockResolvedValue([])
    mockRequestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED)
  })

  afterEach(() => {
    Object.defineProperty(Platform, "Version", {
      value: DEFAULT_PLATFORM_VERSION,
      configurable: true,
    })
  })

  it("writes the base64 payload into the Downloads folder", async () => {
    await expect(saveCsvToDownloads(CSV_BASE64)).resolves.toBe(
      "/mock/downloads/blink-transactions.csv",
    )

    expect(RNFS.writeFile).toHaveBeenCalledWith(
      "/mock/downloads/blink-transactions.csv",
      CSV_BASE64,
      "base64",
    )
  })

  it("registers the file with MediaStore so it shows up in the Files app", async () => {
    await saveCsvToDownloads(CSV_BASE64)

    expect(RNFS.scanFile).toHaveBeenCalledWith("/mock/downloads/blink-transactions.csv")
  })

  it("numbers the copy instead of overwriting an export the user already has", async () => {
    ;(RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      [
        "/mock/downloads/blink-transactions.csv",
        "/mock/downloads/blink-transactions-1.csv",
      ].includes(path),
    )

    await expect(saveCsvToDownloads(CSV_BASE64)).resolves.toBe(
      "/mock/downloads/blink-transactions-2.csv",
    )
  })

  it("rejects rather than looping when every candidate filename is taken", async () => {
    ;(RNFS.exists as jest.Mock).mockResolvedValue(true)

    await expect(saveCsvToDownloads(CSV_BASE64)).rejects.toThrow()
    expect(RNFS.writeFile).not.toHaveBeenCalled()
  })

  it("moves to the next numbered name when a write fails on a name exists missed", async () => {
    ;(RNFS.writeFile as jest.Mock).mockRejectedValueOnce(new Error("EACCES"))

    await expect(saveCsvToDownloads(CSV_BASE64)).resolves.toBe(
      "/mock/downloads/blink-transactions-1.csv",
    )
    expect(RNFS.scanFile).toHaveBeenCalledWith("/mock/downloads/blink-transactions-1.csv")
  })

  it("rejects after a second failed write so the caller can fall back to sharing", async () => {
    ;(RNFS.writeFile as jest.Mock).mockRejectedValue(new Error("EACCES"))

    await expect(saveCsvToDownloads(CSV_BASE64)).rejects.toThrow("EACCES")
    expect(RNFS.writeFile).toHaveBeenCalledTimes(2)
    expect(RNFS.scanFile).not.toHaveBeenCalled()
  })

  it("does not ask for the legacy storage grant from API 29 up", async () => {
    setAndroidVersion(29)

    await saveCsvToDownloads(CSV_BASE64)

    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  it("writes rather than asking for a grant when the API level is unreadable", async () => {
    setAndroidVersion(undefined as unknown as number)

    await saveCsvToDownloads(CSV_BASE64)

    expect(mockRequestPermission).not.toHaveBeenCalled()
    expect(RNFS.writeFile).toHaveBeenCalled()
  })

  it("asks for the legacy storage grant below API 29", async () => {
    setAndroidVersion(28)

    await saveCsvToDownloads(CSV_BASE64)

    expect(mockRequestPermission).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    )
    expect(RNFS.writeFile).toHaveBeenCalled()
  })

  it("resolves null without writing when the storage grant is refused", async () => {
    setAndroidVersion(28)
    mockRequestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED)

    await expect(saveCsvToDownloads(CSV_BASE64)).resolves.toBeNull()
    expect(RNFS.writeFile).not.toHaveBeenCalled()
  })
})
