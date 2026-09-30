package com.galoyapp

import android.content.Context

/**
 * Applies [CrashCollectionPolicy] to the crash SDK and to the word the device remembers.
 *
 * Called from [MainApplication.onCreate] and from the `CrashCollection` React module.
 * `onCreate` runs a few microseconds after React Native Firebase has set collection from
 * its own stored preference. The SDK waits on a network fetch before it uploads anything,
 * so the decision here lands well before an upload could — and deleting the unsent reports
 * removes the ones that must not go.
 */
object CrashCollection {
  private const val PREFS = "blink_crash_collection"
  private const val KEY_PROVENANCE = "provenance"

  /** Swapped in tests. Production always talks to Firebase. */
  internal var reporter: CrashReporter = FirebaseCrashReporter

  fun applyLaunch(context: Context) {
    apply(context, CrashCollectionPolicy.atLaunch(provenanceOf(context)))
  }

  fun applyDisposition(context: Context, permitted: Boolean) {
    apply(context, CrashCollectionPolicy.onDisposition(permitted))
  }

  internal fun provenanceOf(context: Context): String? =
    prefsOf(context).getString(KEY_PROVENANCE, null)

  private fun prefsOf(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun apply(context: Context, decision: CrashCollectionPolicy.Decision) {
    // The word goes down first. If the process dies between here and the SDK calls, the
    // next launch errs on the side of not sending.
    prefsOf(context).edit().putString(KEY_PROVENANCE, decision.provenance).commit()
    reporter.setCollectionEnabled(decision.collect)
    if (decision.deleteUnsent) reporter.deleteUnsentReports()
  }
}
