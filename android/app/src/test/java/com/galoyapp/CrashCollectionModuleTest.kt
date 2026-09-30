package com.galoyapp

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.ReactApplicationContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The bridge between JavaScript and [CrashCollection]: its name, and that a call lands. */
@RunWith(RobolectricTestRunner::class)
@Config(
    application = TestApplication::class,
    // Robolectric needs Java 21 to emulate SDK 36 (the default from targetSdk), but the RN
    // Gradle plugin pins the test toolchain to Java 17. Same as BitcoinPriceWidgetTest.
    sdk = [35],
)
class CrashCollectionModuleTest {

  private class RecordingReporter : CrashReporter {
    val collectCalls = mutableListOf<Boolean>()
    var deleteCalls = 0

    override fun setCollectionEnabled(enabled: Boolean) {
      collectCalls.add(enabled)
    }

    override fun deleteUnsentReports() {
      deleteCalls += 1
    }
  }

  private lateinit var reactContext: ReactApplicationContext
  private lateinit var reporter: RecordingReporter

  @Before
  fun setUp() {
    val context: Context = ApplicationProvider.getApplicationContext()
    context
      .getSharedPreferences("blink_crash_collection", Context.MODE_PRIVATE)
      .edit()
      .clear()
      .commit()
    // Concrete, and takes a plain Context: enough for a module that only reads it.
    reactContext = BridgeReactContext(context)
    reporter = RecordingReporter()
    CrashCollection.reporter = reporter
  }

  @After
  fun tearDown() {
    CrashCollection.reporter = FirebaseCrashReporter
  }

  @Test
  fun `is registered under the name JavaScript looks it up by`() {
    val module = CrashCollectionModule(reactContext)

    assertEquals("CrashCollection", module.name)
    assertEquals(CrashCollectionModule.NAME, module.name)
  }

  @Test
  fun `a permitted disposition reaches the SDK and is remembered`() {
    CrashCollectionModule(reactContext).setCrashCollectionDisposition(true)

    assertEquals(listOf(true), reporter.collectCalls)
    assertEquals(0, reporter.deleteCalls)
    assertEquals(
      CrashCollectionPolicy.PERMITTED,
      CrashCollection.provenanceOf(reactContext),
    )
  }

  @Test
  fun `a denied disposition stops the SDK and deletes what it holds`() {
    CrashCollectionModule(reactContext).setCrashCollectionDisposition(false)

    assertEquals(listOf(false), reporter.collectCalls)
    assertEquals(1, reporter.deleteCalls)
    assertEquals(CrashCollectionPolicy.DENIED, CrashCollection.provenanceOf(reactContext))
  }

  @Test
  fun `the package hands React the module and no view managers`() {
    val pkg = CrashCollectionPackage()

    val modules = pkg.createNativeModules(reactContext)

    assertEquals(1, modules.size)
    assertTrue(modules.first() is CrashCollectionModule)
    assertTrue(pkg.createViewManagers(reactContext).isEmpty())
  }
}
