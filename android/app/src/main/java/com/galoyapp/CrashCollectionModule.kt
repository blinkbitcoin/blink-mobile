package com.galoyapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * The one runtime switch for automatic crash collection, driven by the telemetry
 * disposition in `app/utils/error-reporting.ts`. React Native Firebase's own
 * `setCrashlyticsCollectionEnabled` only persists a preference for the *next* launch; this
 * changes the running process, and records the provenance the next launch decides by.
 */
class CrashCollectionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CrashCollection"

  @ReactMethod
  fun setCrashCollectionDisposition(permitted: Boolean) {
    CrashCollection.applyDisposition(reactApplicationContext, permitted)
  }
}

class CrashCollectionPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(CrashCollectionModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
