package com.galoyapp

/**
 * When automatic crash collection may run, and what to do with reports the crash SDK is
 * still holding on disk.
 *
 * Two facts about Crashlytics shape this. It writes a crash report when the crash happens
 * and uploads it at the *next* launch, so the decision about any report is taken one
 * process later than the crash itself. And it records a crash even while collection is
 * switched off — it only holds the upload back — so "collection was off" does not tell us
 * whether a report already on disk is one we are allowed to send.
 *
 * So the device remembers one word: what the *previous* session was allowed to do when it
 * ended. That is also what any crash in that session was allowed to do, because a crash
 * ends its session. Every launch reads the word, decides, and resets it to `unresolved` for
 * the session now starting; JavaScript overwrites it with `permitted` or `denied` as soon
 * as it knows which kind of wallet this is.
 *
 *  - previous session `permitted`: collect from the start, so the SDK sends what it holds.
 *  - anything else — `denied`, `unresolved`, or a first install: do not collect, and delete
 *    what it holds. A crash from an incognito wallet, or from a session that never said
 *    what it was, never leaves the device.
 *
 * This object is pure so the table can be unit-tested on its own. [CrashCollection] is what
 * applies a decision.
 */
object CrashCollectionPolicy {
  const val PERMITTED = "permitted"
  const val DENIED = "denied"
  const val UNRESOLVED = "unresolved"

  data class Decision(
    /** Whether the SDK may collect and upload from now on. */
    val collect: Boolean,
    /** Whether reports already on disk must be deleted before anything could send them. */
    val deleteUnsent: Boolean,
    /** What the device should remember as the permission in force from this point. */
    val provenance: String,
  )

  /** At process start, from the word the previous session left. Null on a first install. */
  fun atLaunch(previous: String?): Decision {
    val permitted = previous == PERMITTED
    return Decision(collect = permitted, deleteUnsent = !permitted, provenance = UNRESOLVED)
  }

  /** When JavaScript works out what this session is allowed to do. */
  fun onDisposition(permitted: Boolean): Decision =
    Decision(
      collect = permitted,
      deleteUnsent = !permitted,
      provenance = if (permitted) PERMITTED else DENIED,
    )
}
