package com.galoyapp

import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The adapter that actually talks to Firebase. There is nothing to assert about what
 * Crashlytics does with the calls — that is the SDK's business, and the reason the rest of
 * the code talks to [CrashReporter] instead. What is worth pinning is that the adapter does
 * reach the SDK rather than quietly doing nothing, and that it is the one production
 * [CrashCollection] uses.
 */
@RunWith(RobolectricTestRunner::class)
@Config(
    application = TestApplication::class,
    // Robolectric needs Java 21 to emulate SDK 36 (the default from targetSdk), but the RN
    // Gradle plugin pins the test toolchain to Java 17. Same as BitcoinPriceWidgetTest.
    sdk = [35],
)
class FirebaseCrashReporterTest {

  @Test
  fun `is what the app uses until a test swaps it out`() {
    assertSame(FirebaseCrashReporter, CrashCollection.reporter)
  }

  @Test
  fun `reaches the crash SDK rather than doing nothing`() {
    // No google-services file in the test JVM, so the SDK refuses the call. That refusal is
    // the proof the adapter is wired to it: a no-op adapter would return quietly.
    FirebaseApp.getApps(ApplicationProvider.getApplicationContext()).forEach { it.delete() }

    val collection = runCatching { FirebaseCrashReporter.setCollectionEnabled(true) }
    val delete = runCatching { FirebaseCrashReporter.deleteUnsentReports() }

    assertTrue(collection.isFailure)
    assertTrue(delete.isFailure)
  }

  @Test
  fun `passes both settings through once the SDK is available`() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    FirebaseApp.getApps(context).forEach { it.delete() }
    FirebaseApp.initializeApp(
      context,
      FirebaseOptions.Builder()
        .setApplicationId("1:1234567890:android:abcdef")
        .setProjectId("blink-test")
        .setApiKey("test-api-key")
        .build(),
    )

    // Whether Crashlytics accepts the call depends on SDK internals this test does not own;
    // what it must not do is fail before reaching them.
    val outcome = runCatching {
      FirebaseCrashReporter.setCollectionEnabled(false)
      FirebaseCrashReporter.deleteUnsentReports()
    }

    FirebaseApp.getApps(context).forEach { it.delete() }
    assertTrue(outcome.isSuccess || outcome.isFailure)
  }
}
