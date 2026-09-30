package com.galoyapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * The one runtime switch for automatic crash collection, driven from
 * `app/utils/error-reporting.ts` once it knows what this session may send.
 *
 * React Native Firebase has its own `setCrashlyticsCollectionEnabled`, but that only
 * stores a preference the *next* launch reads. This changes the running process, and
 * records the word that next launch will decide by.
 */
class CrashCollectionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setCrashCollectionDisposition(permitted: Boolean) {
    CrashCollection.applyDisposition(reactApplicationContext, permitted)
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
