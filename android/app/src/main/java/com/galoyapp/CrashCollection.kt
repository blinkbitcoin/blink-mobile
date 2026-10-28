package com.galoyapp

import android.content.Context

/**
 * Applies [CrashCollectionPolicy] to the crash SDK and to the word the device remembers.
 *
 * Called from [MainApplication.onCreate] and from the `CrashCollection` React module. React
 * Native Firebase also sets the switch, once, at process start, from a preference that
 * `app/utils/error-reporting.ts` keeps equal to "this session is permitted". So whatever a
 * launch starts from is the previous session's answer — the same thing the word records —
 * and this object turns collection off straight after.
 *
 * One window is left: a native crash in a launch that follows a permitted session, before
 * JavaScript has run. The preference still says permitted at that point, so the launch after
 * starts collecting and the SDK sends that report. Closing it would mean resetting React
 * Native Firebase's preference here, which also switches off its JavaScript crash handler
 * for the whole session, because that handler reads the preference once at start-up.
 */
object CrashCollection {
  private const val PREFS = "blink_crash_collection"
  private const val KEY_PROVENANCE = "provenance"

  /** Swapped in tests. Production always talks to Firebase. */
  internal var reporter: CrashReporter = FirebaseCrashReporter

  fun applyLaunch(context: Context) {
    apply(context, CrashCollectionPolicy.atLaunch(provenanceOf(context)))
  }

  fun applyDisposition(context: Context, disposition: String) {
    apply(context, CrashCollectionPolicy.onDisposition(disposition))
  }

  internal fun provenanceOf(context: Context): String? =
    prefsOf(context).getString(KEY_PROVENANCE, null)

  private fun prefsOf(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /**
   * The word goes down first: if the process dies part-way, the next launch errs on the side
   * of not sending. Then collection goes off before reports are sent or deleted, because the
   * SDK honours an explicit send or delete only while its own collection is off; and on
   * last, so a report kept for this session is not sent by the switch before it is decided.
   */
  private fun apply(context: Context, decision: CrashCollectionPolicy.Decision) {
    prefsOf(context).edit().putString(KEY_PROVENANCE, decision.provenance).commit()
    if (!decision.collect) reporter.setCollectionEnabled(false)
    if (decision.sendUnsent) reporter.sendUnsentReports()
    if (decision.deleteUnsent) reporter.deleteUnsentReports()
    if (decision.collect) reporter.setCollectionEnabled(true)
  }
}
