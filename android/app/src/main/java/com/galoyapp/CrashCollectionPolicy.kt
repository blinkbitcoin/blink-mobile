package com.galoyapp

/**
 * When automatic crash collection may run, and what to do with reports the SDK is holding
 * (AD-13, NFR-P1 — the telemetry boundary's rule, applied to fatal crashes).
 *
 * Two facts about the SDK shape this. First, Crashlytics writes a crash report at crash
 * time and uploads it at the *next* launch, so the decision about a report is always
 * taken one process later than the crash. Second, the SDK records a crash even while
 * collection is disabled — it only withholds the upload — so "disabled" alone cannot say
 * whether a report on disk was created under a disposition that permits sending it.
 *
 * The device therefore keeps a one-word provenance: the disposition the *last* session
 * was in when it ended, which is by construction the disposition any crash in it happened
 * under (a crash ends its session). Every launch reads it, decides, and resets it to
 * `unresolved` for the session now starting; the JavaScript boundary overwrites it with
 * `permitted` or `denied` once the mode resolves.
 *
 *  - previous session ended `permitted`: collection on from the start, so the SDK uploads
 *    the reports it holds — every one of them created under a permitted disposition.
 *  - anything else (`denied`, `unresolved`, first install): collection off, and the held
 *    reports deleted — a crash from an incognito wallet, or from a session that never
 *    said what it was, never leaves the device.
 *
 * Pure, so the table is unit-tested on the JVM; [CrashCollection] applies it to Firebase.
 */
object CrashCollectionPolicy {
  const val PERMITTED = "permitted"
  const val DENIED = "denied"
  const val UNRESOLVED = "unresolved"

  data class Decision(
    /** Whether the SDK may collect and upload from now on. */
    val collect: Boolean,
    /** Whether reports the SDK is holding must be deleted before anything could send them. */
    val deleteUnsent: Boolean,
    /** What the device should remember as the disposition in force from this point. */
    val provenance: String,
  )

  /** At process start, from the provenance the previous session left (null on first install). */
  fun atLaunch(previous: String?): Decision {
    val permitted = previous == PERMITTED
    return Decision(collect = permitted, deleteUnsent = !permitted, provenance = UNRESOLVED)
  }

  /** When the JavaScript boundary resolves a disposition for the running session. */
  fun onDisposition(permitted: Boolean): Decision =
    Decision(
      collect = permitted,
      deleteUnsent = !permitted,
      provenance = if (permitted) PERMITTED else DENIED,
    )
}
