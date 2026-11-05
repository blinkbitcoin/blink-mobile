package com.hieuvp.fingerprint

import android.app.Activity
import android.hardware.biometrics.BiometricManager
import android.os.Looper
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.galoyapp.TestApplication
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowBiometricManager

/**
 * Pins the threading the Crashlytics issue 3fb748a7 turned on. `release()` arrives on
 * React Native's native-modules queue, and walking the FragmentManager from there
 * throws ConcurrentModificationException whenever the main thread commits a fragment
 * at the same moment — which it does every time a prompt closes.
 *
 * The main looper is paused (Robolectric's default), so "has not run yet" is an
 * observable state rather than a timing guess.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = TestApplication::class, sdk = [35])
class ReactNativeFingerprintScannerModuleTest {

  private class RecordingPrompt(
    activity: FragmentActivity,
    executor: Executor,
    val callback: BiometricPrompt.AuthenticationCallback,
    private val storeWalksPerCancel: Int,
  ) : BiometricPrompt(activity, executor, callback) {
    val cancelThreads = CopyOnWriteArrayList<Thread>()
    var authenticateCalls = 0

    override fun cancelAuthentication() {
      cancelThreads.add(Thread.currentThread())
      // The real lookup, so a call off the main thread walks the real store.
      repeat(storeWalksPerCancel) { super.cancelAuthentication() }
    }

    override fun authenticate(info: PromptInfo) {
      authenticateCalls++
    }
  }

  private class TestModule(context: TestReactContext) :
    ReactNativeFingerprintScannerModule(context) {
    val prompts = CopyOnWriteArrayList<RecordingPrompt>()
    var storeWalksPerCancel = 1

    override fun createBiometricPrompt(
      fragmentActivity: FragmentActivity,
      executor: Executor,
      callback: BiometricPrompt.AuthenticationCallback,
    ): BiometricPrompt =
      RecordingPrompt(fragmentActivity, executor, callback, storeWalksPerCancel).also {
        prompts.add(it)
      }
  }

  private class TestReactContext(application: TestApplication) : BridgeReactContext(application) {
    var activity: Activity? = null
    val lifecycleListeners = CopyOnWriteArrayList<LifecycleEventListener>()

    override fun getCurrentActivity(): Activity? = activity

    override fun addLifecycleEventListener(listener: LifecycleEventListener) {
      lifecycleListeners.add(listener)
      super.addLifecycleEventListener(listener)
    }

    override fun removeLifecycleEventListener(listener: LifecycleEventListener) {
      lifecycleListeners.remove(listener)
      super.removeLifecycleEventListener(listener)
    }
  }

  private class RecordingPromise : Promise {
    val rejections = CopyOnWriteArrayList<String?>()
    var resolved = false

    override fun resolve(value: Any?) {
      resolved = true
    }

    override fun reject(code: String?, message: String?) {
      rejections.add(code)
    }

    override fun reject(code: String?, throwable: Throwable?) = unexpected()

    override fun reject(code: String?, message: String?, throwable: Throwable?) = unexpected()

    override fun reject(throwable: Throwable) = unexpected()

    override fun reject(throwable: Throwable, userInfo: WritableMap) = unexpected()

    override fun reject(code: String?, userInfo: WritableMap) = unexpected()

    override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) = unexpected()

    override fun reject(code: String?, message: String?, userInfo: WritableMap) = unexpected()

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?,
    ) = unexpected()

    override fun reject(message: String) = unexpected()

    private fun unexpected(): Unit =
      throw AssertionError("the module only rejects with a code and a message")
  }

  private val mainThread: Thread = Looper.getMainLooper().thread
  private lateinit var activityController: ActivityController<FragmentActivity>
  private lateinit var activity: FragmentActivity
  private lateinit var context: TestReactContext
  private lateinit var module: TestModule

  @Before
  fun setUp() {
    val application = ApplicationProvider.getApplicationContext<TestApplication>()
    Shadow.extract<ShadowBiometricManager>(
      application.getSystemService(BiometricManager::class.java),
    ).apply {
      setCanAuthenticate(true)
      setAuthenticatorType(BiometricManager.Authenticators.BIOMETRIC_WEAK)
    }
    activityController = Robolectric.buildActivity(FragmentActivity::class.java).setup()
    activity = activityController.get()
    context = TestReactContext(application).also { it.activity = activity }
    module = TestModule(context)
  }

  private fun runMainLooper() = shadowOf(Looper.getMainLooper()).idle()

  private fun authenticate(promise: Promise = RecordingPromise()) =
    module.authenticate("title", "subtitle", "description", "Cancel", promise)

  private fun openPrompt(): RecordingPrompt {
    authenticate()
    runMainLooper()
    return module.prompts.last()
  }

  private fun onWorkers(count: Int = 1, block: () -> Unit) {
    val failure = AtomicReference<Throwable>()
    val workers = List(count) {
      Thread {
        try {
          block()
        } catch (t: Throwable) {
          failure.compareAndSet(null, t)
        }
      }
    }
    workers.forEach { it.start() }
    workers.forEach { it.join() }
    failure.get()?.let { throw AssertionError("worker threw", it) }
  }

  @Test
  fun `release from a worker leaves the prompt alone until the main thread runs it`() {
    val prompt = openPrompt()

    onWorkers { module.release() }

    assertTrue("touched the prompt off the main thread", prompt.cancelThreads.isEmpty())

    runMainLooper()

    assertEquals(listOf(mainThread), prompt.cancelThreads.toList())
  }

  @Test
  fun `release on the main thread cancels before it returns`() {
    val prompt = openPrompt()

    module.release()

    assertEquals(listOf(mainThread), prompt.cancelThreads.toList())
  }

  @Test
  fun `the activity going away cancels an open prompt before it finishes destroying`() {
    val prompt = openPrompt()

    context.onHostDestroy()

    assertEquals(listOf(mainThread), prompt.cancelThreads.toList())
  }

  @Test
  fun `release stops listening for the activity going away`() {
    openPrompt()
    assertEquals(listOf(module), context.lifecycleListeners.toList())

    onWorkers { module.release() }
    runMainLooper()

    assertTrue(context.lifecycleListeners.isEmpty())
  }

  @Test
  fun `concurrent releases cancel once`() {
    val prompt = openPrompt()

    onWorkers(count = 8) { repeat(25) { module.release() } }
    runMainLooper()

    assertEquals(listOf(mainThread), prompt.cancelThreads.toList())
  }

  @Test
  fun `releasing with no prompt is a no-op`() {
    onWorkers { module.release() }
    runMainLooper()
    module.release()

    assertTrue(module.prompts.isEmpty())
  }

  @Test
  fun `a release then an authenticate from JS keep their order`() {
    val first = openPrompt()
    val promise = RecordingPromise()

    onWorkers {
      module.release()
      authenticate(promise)
    }
    runMainLooper()

    assertEquals(listOf(mainThread), first.cancelThreads.toList())
    assertEquals(2, module.prompts.size)
    val second = module.prompts.last()
    assertTrue("cancelled the prompt that replaced it", second.cancelThreads.isEmpty())
    assertEquals(1, second.authenticateCalls)

    // The new prompt answers the new promise, not the one it replaced.
    second.callback.onAuthenticationError(BiometricPrompt.ERROR_CANCELED, "cancelled")
    assertEquals(listOf<String?>("SystemCancel"), promise.rejections.toList())
  }

  @Test
  fun `authenticate with no activity answers JS instead of leaving it waiting`() {
    context.activity = null
    val promise = RecordingPromise()

    authenticate(promise)
    runMainLooper()

    assertEquals(listOf<String?>("SystemCancel"), promise.rejections.toList())
    assertTrue(module.prompts.isEmpty())
  }

  @Test
  fun `authenticate once the activity's state is saved answers JS instead of leaving it waiting`() {
    activityController.pause().stop()
    assertTrue(activity.supportFragmentManager.isStateSaved)
    val promise = RecordingPromise()

    authenticate(promise)
    runMainLooper()

    assertEquals(listOf<String?>("SystemCancel"), promise.rejections.toList())
    assertTrue(module.prompts.isEmpty())
  }

  @Test
  fun `a rejected authenticate does not get in the way of the next one`() {
    context.activity = null
    authenticate()
    runMainLooper()

    context.activity = activity
    val promise = RecordingPromise()
    authenticate(promise)
    runMainLooper()

    assertEquals(1, module.prompts.single().authenticateCalls)
    assertTrue(promise.rejections.isEmpty())
  }

  /**
   * The crash itself, against the real FragmentStore. One walk is too short to reliably
   * overlap a commit, so the prompt repeats it: on the worker that collides at once, and
   * on the main thread nothing can interleave with it however long it runs.
   */
  @Test
  fun `release while the main thread commits fragments never trips the store's iterator`() {
    module.storeWalksPerCancel = STORE_WALKS_TO_FORCE_A_COLLISION
    val fragmentManager = activity.supportFragmentManager
    repeat(8) { fragmentManager.beginTransaction().add(Fragment(), "seed-$it").commitNow() }
    openPrompt()
    val failure = AtomicReference<Throwable>()

    val worker = Thread {
      try {
        module.release()
      } catch (t: Throwable) {
        failure.set(t)
      }
    }
    worker.start()
    while (worker.isAlive) {
      val fragment = Fragment()
      fragmentManager.beginTransaction().add(fragment, "churn").commitNow()
      fragmentManager.beginTransaction().remove(fragment).commitNow()
    }
    worker.join()
    runMainLooper()

    assertNull(failure.get())
  }

  private companion object {
    const val STORE_WALKS_TO_FORCE_A_COLLISION = 50_000
  }
}
