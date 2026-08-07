import RNFS from "react-native-fs"

import { errorCodes, keepLocalCopy, pick } from "@react-native-documents/picker"

// The shared react-native-fs mock only carries directory paths.
jest.mock("react-native-fs", () => ({
  __esModule: true,
  default: { readFile: jest.fn(), unlink: jest.fn() },
}))

import {
  BundleFilePickStatus,
  pickEmergencyBundleFile,
} from "@app/self-custodial/recovery-bundle/bundle-file"

const mockPick = pick as jest.Mock
const mockKeepLocalCopy = keepLocalCopy as jest.Mock
const mockReadFile = RNFS.readFile as jest.Mock
const mockUnlink = RNFS.unlink as jest.Mock

const PAYLOAD = '{"schema":"blink.recovery-bundle-backup.v1"}'

describe("pickEmergencyBundleFile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPick.mockResolvedValue([{ uri: "content://picked", name: "bundle.json" }])
    mockKeepLocalCopy.mockResolvedValue([
      { status: "success", localUri: "file:///cache/bundle.json" },
    ])
    mockReadFile.mockResolvedValue(PAYLOAD)
    mockUnlink.mockResolvedValue(undefined)
  })

  it("returns the file's contents", async () => {
    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Picked,
      content: PAYLOAD,
    })
  })

  it("copies into app storage before reading", async () => {
    // Android hands back a content:// uri that RNFS cannot open directly.
    await pickEmergencyBundleFile()

    expect(mockKeepLocalCopy).toHaveBeenCalledWith({
      files: [{ uri: "content://picked", fileName: "bundle.json" }],
      destination: "cachesDirectory",
    })
    expect(mockReadFile).toHaveBeenCalledWith("file:///cache/bundle.json", "utf8")
  })

  it("does not leave the copy behind", async () => {
    await pickEmergencyBundleFile()

    expect(mockUnlink).toHaveBeenCalledWith("file:///cache/bundle.json")
  })

  it("still returns the contents when the copy cannot be cleaned up", async () => {
    // A cache file we failed to delete is not a reason to withhold a bundle
    // the user is trying to recover with.
    mockUnlink.mockRejectedValue(new Error("busy"))

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Picked,
      content: PAYLOAD,
    })
  })

  it("names the copy itself when the picker reports no filename", async () => {
    mockPick.mockResolvedValue([{ uri: "content://picked", name: null }])

    await pickEmergencyBundleFile()

    expect(mockKeepLocalCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [{ uri: "content://picked", fileName: "emergency-bundle.json" }],
      }),
    )
  })

  it("reports backing out of the picker as its own outcome", async () => {
    // Distinct from a failure: cancelling deserves no error message.
    mockPick.mockRejectedValue({ code: errorCodes.OPERATION_CANCELED })

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Cancelled,
    })
    expect(mockKeepLocalCopy).not.toHaveBeenCalled()
  })

  it("reports a picker failure as unreadable", async () => {
    mockPick.mockRejectedValue({ code: errorCodes.UNABLE_TO_OPEN_FILE_TYPE })

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Unreadable,
    })
  })

  it("reports a non-coded picker failure as unreadable", async () => {
    mockPick.mockRejectedValue(new Error("no activity found"))

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Unreadable,
    })
  })

  it("reports a failed copy as unreadable", async () => {
    mockKeepLocalCopy.mockResolvedValue([{ status: "error", copyError: "denied" }])

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Unreadable,
    })
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it("reports an unreadable copy as unreadable", async () => {
    mockReadFile.mockRejectedValue(new Error("gone"))

    await expect(pickEmergencyBundleFile()).resolves.toEqual({
      status: BundleFilePickStatus.Unreadable,
    })
  })
})
