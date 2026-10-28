package com.galoyapp

import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * The crash-SDK switches [CrashCollection] needs, behind an interface so its rules can be
 * tested without Firebase in the test JVM.
 */
interface CrashReporter {
  fun setCollectionEnabled(enabled: Boolean)

  fun sendUnsentReports()

  fun deleteUnsentReports()
}

object FirebaseCrashReporter : CrashReporter {
  override fun setCollectionEnabled(enabled: Boolean) {
    FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(enabled)
  }

  override fun sendUnsentReports() {
    FirebaseCrashlytics.getInstance().sendUnsentReports()
  }

  override fun deleteUnsentReports() {
    FirebaseCrashlytics.getInstance().deleteUnsentReports()
  }
}
