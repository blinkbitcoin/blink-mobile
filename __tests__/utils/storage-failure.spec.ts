import { version as asyncStorageVersion } from "@react-native-async-storage/async-storage/package.json"

import {
  classifyStorageFailure,
  PINNED_ASYNC_STORAGE_VERSION,
  StorageFailure,
  StorageWriteError,
} from "@app/utils/storage/storage-failure"

describe("storage failure classification", () => {
  it("is pinned to the async-storage version its markers were read from", () => {
    /** If this fails, the library moved: re-read its native error surface (iOS
     *  RNCAsyncStorage.mm, Android AsyncStorageModule.java and next/ErrorHelpers.kt),
     *  update the markers, then update this pin. */
    expect(asyncStorageVersion).toBe(PINNED_ASYNC_STORAGE_VERSION)
  })

  describe("out of space", () => {
    const expectOutOfSpace = (message: string): void => {
      expect(classifyStorageFailure(new Error(message))).toBe(StorageFailure.OutOfSpace)
    }

    it("recognizes SQLite's own wording on Android", () => {
      expectOutOfSpace("database or disk is full (code 13 SQLITE_FULL)")
    })

    it("recognizes the bare SQLITE_FULL code", () => {
      expectOutOfSpace("error code 13: SQLITE_FULL")
    })

    it("matches regardless of the casing the platform used", () => {
      expect(classifyStorageFailure(new Error("DATABASE OR DISK IS FULL"))).toBe(
        StorageFailure.OutOfSpace,
      )
    })
  })

  /**
   * Kept apart from the block above on purpose: these are the right markers for an iOS
   * NSError, and none of them can reach JavaScript on the path this app takes. Without an
   * RNCAsyncStorageDelegate — and there is none in ios/ — a failed read arrives as the fixed
   * "Failed to read storage file." asserted under unknown below, so grouping these with the
   * reachable Android cases would claim iOS coverage the app does not have. They earn their
   * place as the contract a future delegate, or a free-space probe, would have to meet.
   */
  describe("out of space, on the wordings no iOS build reaches today", () => {
    const expectOutOfSpace = (message: string): void => {
      expect(classifyStorageFailure(new Error(message))).toBe(StorageFailure.OutOfSpace)
    }

    it("would recognize the POSIX 28 wording", () => {
      expectOutOfSpace("The operation couldn't be completed. No space left on device")
    })

    it("would recognize the NSCocoa 640 wording", () => {
      expectOutOfSpace(
        'You can\u2019t save the file "manifest.json" because the volume is out of space.',
      )
    })
  })

  describe("unknown", () => {
    it("refuses to conclude anything from Android's opaque database error", () => {
      /** The case that matters most, and the one the message cannot answer: a busy
       *  database and a corrupt one both arrive as this exact string. */
      expect(classifyStorageFailure(new Error("Database Error"))).toBe(
        StorageFailure.Unknown,
      )
    })

    const expectUnknown = (message: string): void => {
      expect(classifyStorageFailure(new Error(message))).toBe(StorageFailure.Unknown)
    }

    it("does not claim an iOS read failure is about space", () => {
      expectUnknown("Failed to read storage file.")
    })

    it("does not claim an iOS manifest write failure is about space", () => {
      expectUnknown("Failed to write manifest file.")
    })

    it("does not claim an iOS encoding failure is about space", () => {
      expectUnknown("Incorrect encoding of storage file: 4")
    })

    it("does not claim Android corruption is about space", () => {
      expectUnknown("database disk image is malformed (code 11 SQLITE_CORRUPT)")
    })

    it("does not claim the Android wrapper's catch-all is about space", () => {
      expectUnknown("Unexpected AsyncStorage error: something else")
    })

    it("handles a rejection that is not an Error at all", () => {
      expect(classifyStorageFailure("plain string")).toBe(StorageFailure.Unknown)
      expect(classifyStorageFailure(undefined)).toBe(StorageFailure.Unknown)
    })

    it("reads space wording out of a non-Error rejection too", () => {
      expect(classifyStorageFailure("database or disk is full")).toBe(
        StorageFailure.OutOfSpace,
      )
    })
  })
})

describe("StorageWriteError", () => {
  /** Callers catch it among unrelated errors, so it has to stay an Error they can tell
   *  apart by type and still report with the store's own message. */
  it("is an Error that keeps the store's message and names itself", () => {
    const error = new StorageWriteError(new Error("Database Error"))

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(StorageWriteError)
    expect(error.message).toBe("Database Error")
    expect(error.name).toBe("StorageWriteError")
  })

  /** The report groups by where the write failed, not by the hook that re-threw it. */
  it("keeps the store's own stack", () => {
    const storeError = new Error("Database Error")

    expect(new StorageWriteError(storeError).stack).toBe(storeError.stack)
  })

  it("keeps a stack of its own when the store's error has none", () => {
    const storeError = new Error("Database Error")
    storeError.stack = undefined

    expect(new StorageWriteError(storeError).stack).toEqual(expect.any(String))
  })

  it("classifies a full disk where the store answered", () => {
    const error = new StorageWriteError(new Error("database or disk is full"))

    expect(error.failure).toBe(StorageFailure.OutOfSpace)
  })

  it("classifies any other refusal as unknown", () => {
    const error = new StorageWriteError(new Error("Database Error"))

    expect(error.failure).toBe(StorageFailure.Unknown)
  })

  it("reads the message and the kind out of a rejection that is not an Error", () => {
    const error = new StorageWriteError("database or disk is full")

    expect(error.message).toBe("database or disk is full")
    expect(error.failure).toBe(StorageFailure.OutOfSpace)
  })
})
