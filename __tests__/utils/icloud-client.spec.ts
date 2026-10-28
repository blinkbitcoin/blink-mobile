const mockUnlink = jest.fn()
const mockExists = jest.fn()

jest.mock("react-native-cloud-storage", () => {
  class CloudStorageError extends Error {
    constructor(
      message: string,
      readonly code: string,
    ) {
      super(message)
    }
  }
  return {
    CloudStorage: {
      setProvider: jest.fn(),
      setProviderOptions: jest.fn(),
      unlink: (...args: unknown[]) => mockUnlink(...args),
      exists: (...args: unknown[]) => mockExists(...args),
    },
    CloudStorageError,
    CloudStorageErrorCode: {
      FILE_NOT_FOUND: "ERR_FILE_NOT_FOUND",
      DELETE_ERROR: "ERR_DELETE_ERROR",
    },
    CloudStorageProvider: { ICloud: "icloud" },
    CloudStorageScope: { AppData: "app_data" },
  }
})

import { CloudStorageError, CloudStorageErrorCode } from "react-native-cloud-storage"

import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { deleteAppDataFile, ICloudError } from "@app/utils/icloud-client"

const FILE_NAME = "blink-spark-recovery-bundle-mainnet-02ab.json"
const PLACEHOLDER_NAME = `.${FILE_NAME}.icloud`

const notFound = () =>
  new CloudStorageError("no such file", CloudStorageErrorCode.FILE_NOT_FOUND)

/** Answers exists() for the names present in iCloud, by form. */
const presentAs = (names: readonly string[]) =>
  mockExists.mockImplementation(async (name: string) => names.includes(name))

describe("icloud client deleteAppDataFile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUnlink.mockResolvedValue(undefined)
  })

  it("removes the downloaded file, and does not touch a placeholder that is not there", async () => {
    // Unlinking a missing path fails with the delete error a real failure uses
    // (seen on the iOS 18 simulator), so only present names are unlinked.
    presentAs([FILE_NAME])

    await deleteAppDataFile(FILE_NAME)

    expect(mockExists).toHaveBeenCalledWith(PLACEHOLDER_NAME, "app_data")
    expect(mockUnlink.mock.calls).toEqual([[FILE_NAME, "app_data"]])
  })

  it("removes an item that is only a placeholder because it was never downloaded", async () => {
    presentAs([PLACEHOLDER_NAME])

    await deleteAppDataFile(FILE_NAME)

    expect(mockUnlink.mock.calls).toEqual([[PLACEHOLDER_NAME, "app_data"]])
  })

  it("counts an item that is in neither form as removed", async () => {
    presentAs([])

    await expect(deleteAppDataFile(FILE_NAME)).resolves.toBeUndefined()
    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it("counts a file removed between the check and the delete as removed", async () => {
    presentAs([FILE_NAME])
    mockUnlink.mockRejectedValueOnce(notFound())

    await expect(deleteAppDataFile(FILE_NAME)).resolves.toBeUndefined()
  })

  it("throws a failed delete classified by its code", async () => {
    presentAs([FILE_NAME])
    mockUnlink.mockRejectedValue(
      new CloudStorageError("unlink failed", CloudStorageErrorCode.DELETE_ERROR),
    )

    const error = await deleteAppDataFile(FILE_NAME).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ICloudError)
    expect(error).toMatchObject({
      reason: CloudBackupErrorReason.Transient,
      message: expect.stringContaining("iCloud delete failed"),
    })
  })
})
