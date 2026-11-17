# Firebase Analytics ad libraries on Android

Firebase Analytics depends on two Google ad libraries: the Privacy Sandbox ad
services (`androidx.privacysandbox.ads:ads-adservices` and `-java`) and the
advertising ID client (`com.google.android.gms:play-services-ads-identifier`).
Blink shows no ads, and app stores such as Zapstore flag an APK that ships them,
so the release build leaves them out. This document explains why that is safe
today, what would break it, and how to check it again.

## What keeps them out

| File | What it does |
|------|--------------|
| `android/app/build.gradle` | Excludes both libraries from every configuration |
| `android/app/src/main/AndroidManifest.xml` | Removes `AD_ID`, `ACCESS_ADSERVICES_AD_ID` and `ACCESS_ADSERVICES_ATTRIBUTION`, which the libraries declare |
| `android/app/proguard-rules.pro` | `-dontwarn` for both packages, since R8 otherwise stops the release build on the missing classes |
| `firebase.json` | Turns off advertising ID collection and the ad storage, ad user data and ad personalization consent defaults |

`__tests__/android/ad-services.spec.ts` checks each of these, ignoring
commented out lines, and pins the Firebase BoM the audit below covered.

## Why it is safe

The audit was done on `@react-native-firebase` 23.3.1, which uses the Firebase
BoM 34.2.0 and `play-services-measurement` 23.0.0.

Measurement still references the excluded classes, and R8 keeps those
references with no classes behind them. In 23.0.0 it only reaches them through
two gates:

- The ad services path needs the `ACCESS_ADSERVICES_ATTRIBUTION` permission,
  which the manifest removes.
- The advertising ID path needs advertising ID collection on and ad storage
  consent granted. `firebase.json` turns both off, and no code grants them at
  runtime.

With both gates closed, no path reaches a missing class, with or without Play
Services.

## What breaks it

Any of these needs the audit below before it ships:

- A Firebase or `@react-native-firebase` upgrade that changes the BoM. The spec
  fails until its pinned version is updated.
- Turning on advertising ID collection or ad storage, in `firebase.json`, or
  granting ad storage at runtime through `setConsent`.
- Putting `ACCESS_ADSERVICES_ATTRIBUTION` back in the manifest.

The failure is usually silent. Measurement runs most of this work as tasks on
its own worker thread, and a `NoClassDefFoundError` there is logged as
`Task exception on worker thread` and dropped. The app keeps running,
Crashlytics sees nothing, and GA4 just stops getting events from those devices.
Only a call made off the worker thread would crash. Watching for crashes alone
misses it, so the check below reads the logs.

## Re-audit

1. **Dependency graph.** From `android/`:

   ```bash
   ./gradlew :app:dependencies --configuration releaseRuntimeClasspath \
     | grep -E "play-services-measurement|privacysandbox|play-services-ads"
   ```

   Note the new `play-services-measurement` version. Neither excluded library
   should appear, and no new ad library such as `play-services-ads` or
   `play-services-appset` should either.

2. **Bytecode.** Take every `play-services-measurement*` AAR of the new version
   from the Gradle cache
   (`~/.gradle/caches/modules-2/files-2.1/com.google.android.gms/`), unzip their
   `classes.jar` and list every class that references
   `androidx/privacysandbox/ads` or `com/google/android/gms/ads/identifier`
   (for example with `javap -c -p`). Each reference must still sit behind one of
   the two gates above.

3. **Release APK.** Build a release APK, then check it with the Android SDK
   tools:

   ```bash
   aapt2 dump badging app-release.apk | grep -E "AD_ID|ADSERVICES|adservices"
   apkanalyzer dex packages --defined-only app-release.apk \
     | grep -E "androidx.privacysandbox.ads|com.google.android.gms.ads.identifier"
   ```

   Both should print nothing. Use `--defined-only`: a plain search of the dex
   finds the references R8 keeps and gives a false alarm.

4. **Runtime logs.** Install the release build on a device or emulator, then:

   ```bash
   adb shell setprop log.tag.FA VERBOSE
   adb shell setprop log.tag.FA-SVC VERBOSE
   adb shell setprop debug.firebase.analytics.app com.galoyapp
   ```

   Start the app from a cold start, sign in, use it for a few minutes, send it
   to the background and back, then:

   ```bash
   adb logcat -d --pid="$(adb shell pidof -s com.galoyapp)" \
     | grep -E "NoClassDefFoundError|Task exception on worker thread"
   ```

   It should print nothing, and the events should show up in Firebase DebugView.
   Clear the debug app afterwards with
   `adb shell setprop debug.firebase.analytics.app .none.`.

5. **Pin.** Update the BoM version in the spec in the same pull request as the
   upgrade.
