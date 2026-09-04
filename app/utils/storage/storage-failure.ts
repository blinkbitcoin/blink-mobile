/**
 * What a storage failure can be told apart into, and how.
 *
 * The native modules hand JavaScript a message and nothing else — `convertError` builds
 * `new Error(error.message)` and keeps only a `key` alongside it, so there is no code, no
 * domain and no cause to branch on. Matching the message is therefore the only option
 * available, not a shortcut, which is why the set below is deliberately small: it names
 * the one failure a user can act on and refuses to guess at the rest.
 *
 * The markers are read off @react-native-async-storage/async-storage 2.2.0. They are that
 * version's wording, so an upgrade has to re-derive them — the spec pins the version and
 * fails when it moves, which is the reminder to come back here.
 */
export const StorageFailure = {
  /** The device has no room left. The user can fix this one themselves. */
  OutOfSpace: "out-of-space",
  /**
   * Anything else, including the case that matters most: Android answers a database it
   * cannot open with the literal string "Database Error" and no detail, so a store that
   * is merely busy and one that is corrupt beyond repair arrive identical. Nothing may be
   * concluded about how permanent this is from the message alone.
   */
  Unknown: "unknown",
} as const

export type StorageFailure = (typeof StorageFailure)[keyof typeof StorageFailure]

/**
 * Lowercased fragments that appear when the device is out of room, across both platforms:
 * Android passes SQLite's own text through `e.getMessage()`, while iOS carries the
 * NSError's localizedDescription (NSCocoa 640 and NSPOSIX 28 word it the two ways below).
 */
const OUT_OF_SPACE_MARKERS = [
  "sqlite_full",
  "database or disk is full",
  "no space left on device",
  "out of space",
] as const

export const classifyStorageFailure = (error: unknown): StorageFailure => {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  const isOutOfSpace = OUT_OF_SPACE_MARKERS.some((marker) => normalized.includes(marker))

  return isOutOfSpace ? StorageFailure.OutOfSpace : StorageFailure.Unknown
}
