package com.galoyapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * The one runtime switch for automatic crash collection, driven from
 * `app/utils/error-reporting.ts` with the session's disposition: `permitted`, `denied` or
 * `unresolved`.
 *
 * React Native Firebase has its own `setCrashlyticsCollectionEnabled`, but that only stores a
 * preference — one its own `recordError` and `log` check, and its start-up re-applies to the
 * SDK. It changes nothing in the running process and nothing about the reports on disk. This
 * does both, and records the word the next launch decides by.
 */
class CrashCollectionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setCrashCollectionDisposition(disposition: String) {
    CrashCollection.applyDisposition(reactApplicationContext, disposition)
  }

  companion object {
    const val NAME = "CrashCollection"
  }
}

class CrashCollectionPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(CrashCollectionModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
