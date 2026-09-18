package com.galoyapp

import android.content.Context
import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * Applies [CrashCollectionPolicy] to Firebase Crashlytics and the device's provenance.
 *
 * Called from [MainApplication.onCreate] and from the `CrashCollection` React module.
 * `onCreate` runs a few microseconds after React Native Firebase's init provider has set
 * collection from its own persisted preference; the SDK's upload of held reports waits on
 * a settings fetch over the network, so the decision here lands long before any upload
 * could — and `deleteUnsentReports` removes what must not go.
 */
object CrashCollection {
  private const val PREFS = "blink_crash_collection"
  private const val KEY_PROVENANCE = "provenance"

  fun applyLaunch(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    apply(context, CrashCollectionPolicy.atLaunch(prefs.getString(KEY_PROVENANCE, null)))
  }

  fun applyDisposition(context: Context, permitted: Boolean) {
    apply(context, CrashCollectionPolicy.onDisposition(permitted))
  }

  private fun apply(context: Context, decision: CrashCollectionPolicy.Decision) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    // Provenance first: if the process dies between here and the SDK calls, the next
    // launch errs on the side of not sending.
    prefs.edit().putString(KEY_PROVENANCE, decision.provenance).commit()
    val crashlytics = FirebaseCrashlytics.getInstance()
    crashlytics.setCrashlyticsCollectionEnabled(decision.collect)
    if (decision.deleteUnsent) crashlytics.deleteUnsentReports()
  }
}
