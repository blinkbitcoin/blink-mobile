package com.galoyapp

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * [CrashCollection] against real SharedPreferences, with the crash SDK recorded rather than
 * called. What is checked is what a launch and a disposition change do to the SDK, in what
 * order, and to the word the device remembers.
 */
@RunWith(RobolectricTestRunner::class)
@Config(
    application = TestApplication::class,
    // Robolectric needs Java 21 to emulate SDK 36 (the default from targetSdk), but the RN
    // Gradle plugin pins the test toolchain to Java 17. Same as BitcoinPriceWidgetTest.
    sdk = [35],
)
class CrashCollectionTest {

  private class RecordingReporter(private val context: Context) : CrashReporter {
    /** Every SDK call in order: `collect:true`, `collect:false`, `send`, `delete`. */
    val calls = mutableListOf<String>()

    /** What the device remembered at the moment the SDK was first told anything. */
    var provenanceWhenToldSdk: String? = null

    private fun record(call: String) {
      if (calls.isEmpty()) provenanceWhenToldSdk = CrashCollection.provenanceOf(context)
      calls.add(call)
    }

    override fun setCollectionEnabled(enabled: Boolean) = record("collect:$enabled")

    override fun sendUnsentReports() = record("send")

    override fun deleteUnsentReports() = record("delete")
  }

  private lateinit var context: Context
  private lateinit var reporter: RecordingReporter

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    context
      .getSharedPreferences("blink_crash_collection", Context.MODE_PRIVATE)
      .edit()
      .clear()
      .commit()
    reporter = RecordingReporter(context)
    CrashCollection.reporter = reporter
  }

  @After
  fun tearDown() {
    CrashCollection.reporter = FirebaseCrashReporter
  }

  private fun remembered(): String? = CrashCollection.provenanceOf(context)

  /** Ends a session in [disposition] and starts the next process, as far as the SDK sees. */
  private fun nextLaunchAfter(disposition: String): List<String> {
    CrashCollection.applyDisposition(context, disposition)
    reporter.calls.clear()
    CrashCollection.applyLaunch(context)
    return reporter.calls.toList()
  }

  @Test
  fun `a first install does not collect and deletes what the SDK holds`() {
    assertNull(remembered())

    CrashCollection.applyLaunch(context)

    assertEquals(listOf("collect:false", "delete"), reporter.calls)
    assertEquals(CrashCollectionPolicy.UNRESOLVED, remembered())
  }

  @Test
  fun `a launch after a permitted session sends what it left, and does not collect`() {
    assertEquals(listOf("collect:false", "send"), nextLaunchAfter("permitted"))
  }

  @Test
  fun `a launch after a denied session deletes what it left`() {
    assertEquals(listOf("collect:false", "delete"), nextLaunchAfter("denied"))
  }

  @Test
  fun `an unresolved session after a permitted one never uploads its crash`() {
    // The session before last was permitted. The last one launched, never resolved, and
    // crashed. Collection was off throughout it, so the SDK held the report; this launch
    // deletes it rather than sending it.
    CrashCollection.applyDisposition(context, "permitted")
    CrashCollection.applyLaunch(context)
    assertFalse(reporter.calls.drop(1).contains("collect:true"))
    reporter.calls.clear()

    CrashCollection.applyLaunch(context)

    assertEquals(listOf("collect:false", "delete"), reporter.calls)
  }

  @Test
  fun `falling back to unresolved mid-session stops collecting and keeps what is held`() {
    CrashCollection.applyDisposition(context, "permitted")
    reporter.calls.clear()

    CrashCollection.applyDisposition(context, "unresolved")

    assertEquals(listOf("collect:false"), reporter.calls)
    assertEquals(CrashCollectionPolicy.UNRESOLVED, remembered())
  }

  @Test
  fun `a crash after falling back to unresolved is deleted at the next launch`() {
    // Permitted, then a restore into a wallet with no mode yet: the session ends unresolved.
    CrashCollection.applyDisposition(context, "permitted")

    assertEquals(listOf("collect:false", "delete"), nextLaunchAfter("unresolved"))
  }

  @Test
  fun `a word it does not recognise is treated as not permitted`() {
    context
      .getSharedPreferences("blink_crash_collection", Context.MODE_PRIVATE)
      .edit()
      .putString("provenance", "something-else")
      .commit()

    CrashCollection.applyLaunch(context)

    assertEquals(listOf("collect:false", "delete"), reporter.calls)
  }

  @Test
  fun `every launch resets the word for the session now starting`() {
    CrashCollection.applyDisposition(context, "permitted")
    assertEquals(CrashCollectionPolicy.PERMITTED, remembered())

    CrashCollection.applyLaunch(context)

    assertEquals(CrashCollectionPolicy.UNRESOLVED, remembered())
  }

  @Test
  fun `resolving permitted collects and records it for the next launch`() {
    CrashCollection.applyDisposition(context, "permitted")

    assertEquals(listOf("collect:true"), reporter.calls)
    assertEquals(CrashCollectionPolicy.PERMITTED, remembered())
  }

  @Test
  fun `resolving denied stops collecting, deletes what is held, and records it`() {
    CrashCollection.applyDisposition(context, "denied")

    assertEquals(listOf("collect:false", "delete"), reporter.calls)
    assertEquals(CrashCollectionPolicy.DENIED, remembered())
  }

  @Test
  fun `reports are only ever sent or deleted while collection is off`() {
    // The SDK honours an explicit send or delete only with its own collection off.
    for (step in listOf("launch", "permitted", "denied", "unresolved", "launch", "permitted")) {
      reporter.calls.clear()
      if (step == "launch") {
        CrashCollection.applyLaunch(context)
      } else {
        CrashCollection.applyDisposition(context, step)
      }
      val switchedOn = reporter.calls.indexOf("collect:true")
      for ((index, call) in reporter.calls.withIndex()) {
        if (call == "send" || call == "delete") {
          assertTrue("$step: $call before collection was off", index > 0)
          assertEquals("$step: $call", "collect:false", reporter.calls.first())
          assertTrue("$step: $call after collection came on", switchedOn < 0 || index < switchedOn)
        }
      }
    }
  }

  @Test
  fun `the word is written before the SDK is told anything`() {
    // A death in between must leave the next launch erring on the side of not sending.
    CrashCollection.applyDisposition(context, "permitted")

    assertEquals(CrashCollectionPolicy.PERMITTED, reporter.provenanceWhenToldSdk)
  }

  @Test
  fun `the word survives a new process reading the same device`() {
    CrashCollection.applyDisposition(context, "permitted")

    // Nothing in memory carries over; the value comes back off disk.
    assertEquals(CrashCollectionPolicy.PERMITTED, CrashCollection.provenanceOf(context))
  }
}
