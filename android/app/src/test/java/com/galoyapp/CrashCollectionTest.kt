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
 * called. What is checked is what a launch and a disposition change do to the two SDK
 * switches and to the word the device remembers.
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
    val collectCalls = mutableListOf<Boolean>()
    var deleteCalls = 0

    /** What the device remembered at the moment the SDK was first told anything. */
    var provenanceWhenToldSdk: String? = null
    private var sawFirstCall = false

    private fun noteFirstCall() {
      if (sawFirstCall) return
      sawFirstCall = true
      provenanceWhenToldSdk = CrashCollection.provenanceOf(context)
    }

    override fun setCollectionEnabled(enabled: Boolean) {
      noteFirstCall()
      collectCalls.add(enabled)
    }

    override fun deleteUnsentReports() {
      noteFirstCall()
      deleteCalls += 1
    }
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

  @Test
  fun `a first install does not collect and deletes what the SDK holds`() {
    assertNull(remembered())

    CrashCollection.applyLaunch(context)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
    assertEquals(CrashCollectionPolicy.UNRESOLVED, remembered())
  }

  @Test
  fun `a launch after a permitted session collects, so its reports are delivered`() {
    CrashCollection.applyDisposition(context, permitted = true)
    reporter.collectCalls.clear()
    reporter.deleteCalls = 0

    CrashCollection.applyLaunch(context)

    assertEquals(listOf(true), reporter.collectCalls)
    assertEquals(0, reporter.deleteCalls)
  }

  @Test
  fun `a launch after a denied session deletes what it holds and starts off`() {
    CrashCollection.applyDisposition(context, permitted = false)
    reporter.collectCalls.clear()
    reporter.deleteCalls = 0

    CrashCollection.applyLaunch(context)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
  }

  @Test
  fun `a launch after a session that never resolved deletes what it holds`() {
    // The previous session crashed before it knew what it was allowed to do, so its
    // report never goes — even if the session before that one was permitted.
    CrashCollection.applyDisposition(context, permitted = true)
    CrashCollection.applyLaunch(context) // that session ends unresolved
    reporter.collectCalls.clear()
    reporter.deleteCalls = 0

    CrashCollection.applyLaunch(context)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
  }

  @Test
  fun `a word it does not recognise is treated as not permitted`() {
    context
      .getSharedPreferences("blink_crash_collection", Context.MODE_PRIVATE)
      .edit()
      .putString("provenance", "something-else")
      .commit()

    CrashCollection.applyLaunch(context)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
  }

  @Test
  fun `every launch resets the word for the session now starting`() {
    CrashCollection.applyDisposition(context, permitted = true)
    assertEquals(CrashCollectionPolicy.PERMITTED, remembered())

    CrashCollection.applyLaunch(context)

    assertEquals(CrashCollectionPolicy.UNRESOLVED, remembered())
  }

  @Test
  fun `resolving permitted collects and records it for the next launch`() {
    CrashCollection.applyDisposition(context, permitted = true)

    assertEquals(listOf(true), reporter.collectCalls)
    assertEquals(0, reporter.deleteCalls)
    assertEquals(CrashCollectionPolicy.PERMITTED, remembered())
  }

  @Test
  fun `resolving denied stops collecting, deletes what is held, and records it`() {
    CrashCollection.applyDisposition(context, permitted = false)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
    assertEquals(CrashCollectionPolicy.DENIED, remembered())
  }

  @Test
  fun `the word is written before the SDK is told anything`() {
    // A death in between must leave the next launch erring on the side of not sending.
    CrashCollection.applyDisposition(context, permitted = true)

    assertEquals(CrashCollectionPolicy.PERMITTED, reporter.provenanceWhenToldSdk)
  }

  @Test
  fun `the word survives a new process reading the same device`() {
    CrashCollection.applyDisposition(context, permitted = true)

    // Nothing in memory carries over; the value comes back off disk.
    assertEquals(CrashCollectionPolicy.PERMITTED, CrashCollection.provenanceOf(context))
    assertTrue(reporter.collectCalls.isNotEmpty())
    assertFalse(reporter.collectCalls.contains(false))
  }
}
