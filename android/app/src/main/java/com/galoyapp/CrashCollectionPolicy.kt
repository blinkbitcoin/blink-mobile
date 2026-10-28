package com.galoyapp

/**
 * When automatic crash collection may run, and what to do with reports the crash SDK is
 * still holding on disk.
 *
 * Three facts about Crashlytics shape this. It records a crash even while collection is off
 * and only holds the upload back, so "collection was off" says nothing about whether a
 * report on disk may go. It decides what to do with the reports on disk once per launch,
 * from whatever its collection switch says at that moment: switched on, it sends them
 * straight away; switched off, it waits for an explicit send or delete. And the switch it
 * starts from is the previous process's: the SDK persists the last value it was given, and
 * React Native Firebase re-applies its own stored copy at start-up.
 *
 * So two things are kept true at all times. The switch is on only while the session is
 * known to be permitted — never at launch, never while unresolved — so whatever the SDK
 * reads at the next launch is what the previous session was allowed to do when it ended.
 * And the device remembers that same answer as one word, which the launch reads to send or
 * delete what was left. A crash ends its session, so the word is also what any crash in
 * that session was allowed to do.
 *
 *  - previous session `permitted`: send what it left. Collection stays off until this
 *    session says what it is.
 *  - anything else — `denied`, `unresolved`, a first install, an unknown word: delete what
 *    it left. A crash from an incognito wallet, or from a session that never said what it
 *    was, never leaves the device.
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
    /** Whether reports already on disk are to be sent. */
    val sendUnsent: Boolean,
    /** Whether reports already on disk must be deleted before anything could send them. */
    val deleteUnsent: Boolean,
    /** What the device should remember as the permission in force from this point. */
    val provenance: String,
  )

  /** At process start, from the word the previous session left. Null on a first install. */
  fun atLaunch(previous: String?): Decision {
    val permitted = previous == PERMITTED
    return Decision(
      collect = false,
      sendUnsent = permitted,
      deleteUnsent = !permitted,
      provenance = UNRESOLVED,
    )
  }

  /**
   * When JavaScript works out what this session is allowed to do, or stops knowing.
   *
   * `unresolved` turns collection off and keeps what is on disk: the session may still turn
   * out permitted, and if it never does the next launch deletes it. Anything unrecognised is
   * treated as unresolved, which collects nothing.
   */
  fun onDisposition(disposition: String): Decision =
    when (disposition) {
      PERMITTED ->
        Decision(collect = true, sendUnsent = false, deleteUnsent = false, provenance = PERMITTED)
      DENIED ->
        Decision(collect = false, sendUnsent = false, deleteUnsent = true, provenance = DENIED)
      else ->
        Decision(collect = false, sendUnsent = false, deleteUnsent = false, provenance = UNRESOLVED)
    }
}
