/**
 * What a storage failure can be told apart into, and how.
 *
 * The native modules hand JavaScript a message and nothing else — `convertError` builds
 * `new Error(error.message)` and keeps only a `key` alongside it, so there is no code, no
 * domain and no cause to branch on. Matching the message is therefore the only option
 * available, not a shortcut, which is why the set below is deliberately small: it names
 * the one failure a user can act on and refuses to guess at the rest.
 *
 * The markers are read off the async-storage version pinned below. They are that version's
 * wording, so an upgrade has to re-derive them — the spec asserts the pin against the
 * installed package and fails when it moves, which is the reminder to come back here.
 */
/** Exported so the spec asserts against this value rather than restating it: two copies of
 *  the same fact drift, and the drift is exactly what the pin exists to catch. */
export const PINNED_ASYNC_STORAGE_VERSION = "2.2.0"
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

/** What a storage write answers with. The boolean alone loses the one thing the user can
 *  act on, a full disk, so the kind travels with it. Null unless the write failed. */
export type StorageWriteResult = {
  isSaved: boolean
  failure: StorageFailure | null
}

/**
 * Lowercased fragments that appear when the device is out of room. Only Android reaches
 * them today; iOS reports a fixed string that says nothing, so it classifies as Unknown and
 * gets the generic copy. The iOS wordings are kept for the day that changes.
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
