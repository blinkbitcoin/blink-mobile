# Verifying Android env config survives R8 (`react-native-config` + ProGuard)

This document explains a class of Android-only bug where `react-native-config`
values (`BREEZ_API_KEY`, `SPARK_TOKEN_IDENTIFIER`, `BREEZ_NETWORK`, …) are
present in the build but **stripped from the release APK by R8/ProGuard**, and
how to reproduce and verify both the problem and the fix locally — without a
device and without real secrets.

It was written after the self-custodial wallet showed *"Wallet is offline — your
non-custodial wallet can't reach the network right now"* on Google Play internal
testing while iOS TestFlight worked.

## Root cause

`react-native-config` is the only env mechanism in the app and is consumed in
just three files; the only production consumer is the self-custodial wallet
(`app/self-custodial/config.ts`). On Android it reads values by **reflection**
over the generated `com.galoyapp.BuildConfig` class (see `RNCConfigModule` in
the `react-native-config` package: `Class.forName(pkg + ".BuildConfig")` +
`java.lang.reflect.Field`).

Release builds enable minification (`enableProguardInReleaseBuilds = true` →
`minifyEnabled` in `android/app/build.gradle`). Because the `BuildConfig`
constants are only ever read via reflection, R8 considers them unused and
removes them. At runtime `Config.BREEZ_API_KEY` is then `null`; the SDK connects
with an empty API key, fails to authenticate, and the wallet reports itself
offline. iOS has no R8 step and reads config differently, so it is unaffected —
which is why the failure was Android-release-only.

Two contributing factors made it silent:

- `app/self-custodial/config.ts` previously did `apiKey: Config.BREEZ_API_KEY ?? ""`,
  turning a missing key into a misleading "offline" network error instead of a
  clear misconfiguration failure.
- Nothing in production relied on `react-native-config` before the self-custodial
  feature, so the latent stripping was never exercised.

## The fix

1. **Keep rule** — `android/app/proguard-rules.pro`:

   ```proguard
   -keep class com.galoyapp.BuildConfig { *; }
   ```

2. **Fail loud** — `app/self-custodial/config.ts` exposes `requireBreezApiKey()`
   (mirroring `requireSparkTokenIdentifier()`), called from
   `bridge/lifecycle.ts → createSdkConfig`. A missing key now throws
   `"BREEZ_API_KEY is not configured for this build"` at SDK init instead of
   silently using `""`.

3. **CI gate** — `ci/tasks/build.sh` asserts, after the Android release build,
   that every key from the consumed `.env.ci` survived into the release
   `BuildConfig` (see below). It derives the key list from `.env.ci` itself, so
   any key added there is covered automatically.

## Verifying locally (reproduce the bug + confirm the fix)

This builds a real **minified release** APK — the same build type Play internal
testing ships — and inspects the compiled `BuildConfig`. A placeholder API key
is sufficient: we are verifying that the value *survives the build*, not that it
authenticates against Breez (a functional "wallet comes online" test would
require the real `BREEZ_API_KEY`).

All commands run from the repo root inside the nix dev shell.

### 1. One-time local build inputs

The release signing config in `android/app/build.gradle` uses debug-keystore
credentials (`storePassword 'android'`, `keyAlias 'androiddebugkey'`), so a
self-signed keystore with those values is enough to sign locally:

```bash
nix develop -c keytool -genkeypair -v -keystore android/app/release.keystore \
  -storepass android -keypass android -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"

# Placeholder env — no real secret needed for this check
cat > .env <<'EOF'
BREEZ_API_KEY=placeholder-breez-key-local-test
SPARK_TOKEN_IDENTIFIER=placeholder-spark-token-local-test
BREEZ_NETWORK=mainnet
EOF
```

> NDK note: some native modules (e.g. `react-native-quick-base64`) default to an
> NDK version that is not in the read-only nix SDK (which provides only the
> pinned `27.3.13750724`). Force all modules to the available NDK with a
> throwaway init script so no download is required:
>
> ```bash
> cat > /tmp/ndk-override.init.gradle <<'EOF'
> allprojects {
>   afterEvaluate { project ->
>     def ext = project.extensions.findByName('android')
>     if (ext != null) { ext.ndkVersion = '27.3.13750724' }
>   }
> }
> EOF
> ```

### 2. Build the minified release APK (single ABI for speed)

```bash
cd android && ENVFILE=.env nix develop ..# -c ./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a --no-daemon \
  --init-script /tmp/ndk-override.init.gradle
cd ..
```

### 3. Inspect the compiled `BuildConfig`

```bash
APK=$(ls android/app/build/outputs/apk/release/app-*-release.apk | head -1)
nix develop -c sh -c "apkanalyzer dex code --class com.galoyapp.BuildConfig '$APK'" \
  | grep -E '\.field'
```

**With the keep rule (fixed)** — the keys are present:

```
.field public static final BREEZ_API_KEY:Ljava/lang/String; = "placeholder-breez-key-local-test"
.field public static final BREEZ_NETWORK:Ljava/lang/String; = "mainnet"
.field public static final SPARK_TOKEN_IDENTIFIER:Ljava/lang/String; = "placeholder-spark-token-local-test"
```

**Reproduce the bug** — temporarily remove the `-keep class com.galoyapp.BuildConfig`
line from `android/app/proguard-rules.pro`, rerun step 2 (R8 re-runs in ~40s),
then step 3. The keys — and the whole `BuildConfig` class — are gone:

```
(no fields)
```

Restore the keep rule afterwards.

### 4. Clean up

```bash
rm -f .env android/app/release.keystore /tmp/ndk-override.init.gradle
git checkout -- ios/Podfile.lock   # if a dependency install touched it
```

## CI assertion (no device)

`ci/tasks/build.sh` runs this immediately after `fastlane android build`, before
the `EXIT` trap deletes `.env.ci`:

```bash
APK=$(ls android/app/build/outputs/apk/release/app-*-release.apk | head -1)
nix develop -c sh -c "apkanalyzer dex code --class com.galoyapp.BuildConfig '$APK'" \
  > "${CI_ROOT}/release-buildconfig.dump"
while IFS='=' read -r key _value; do
  case "$key" in ''|\#*) continue ;; esac
  grep -qw "$key" "${CI_ROOT}/release-buildconfig.dump" \
    || { echo "❌ ${key} (from ${ENVFILE}) missing from release BuildConfig"; exit 1; }
done < "$REACT_NATIVE_CONFIG_ENV"
```

This catches a regression (e.g. the keep rule being removed) deterministically,
with no emulator, by reading the key list from the exact file the build consumed.

## Unit coverage

`__tests__/self-custodial/config.spec.ts` covers `requireBreezApiKey()`
(returns the key / throws when missing). `__tests__/self-custodial/bridge/lifecycle.spec.ts`
asserts the key flows into `config.apiKey` at `initSdk`. Note these mock
`react-native-config`, so they verify the JS contract only — they cannot catch
R8 stripping. The release-APK inspection above is the test for that.
