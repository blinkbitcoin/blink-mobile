import { version as asyncStorageVersion } from "@react-native-async-storage/async-storage/package.json"

import {
  classifyStorageFailure,
  StorageFailure,
} from "@app/utils/storage/storage-failure"

/**
 * The version the markers were read off. Bumping the library without re-reading its error
 * surface is the way this classifier goes quietly wrong: the strings are that version's
 * wording, and nothing else in the build would notice them drifting.
 */
const PINNED_ASYNC_STORAGE_VERSION = "2.2.0"

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

    it("recognizes the POSIX 28 wording on iOS", () => {
      expectOutOfSpace("The operation couldn't be completed. No space left on device")
    })

    it("recognizes the NSCocoa 640 wording on iOS", () => {
      expectOutOfSpace(
        'You can\u2019t save the file "manifest.json" because the volume is out of space.',
      )
    })

    it("matches regardless of the casing the platform used", () => {
      expect(classifyStorageFailure(new Error("DATABASE OR DISK IS FULL"))).toBe(
        StorageFailure.OutOfSpace,
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
