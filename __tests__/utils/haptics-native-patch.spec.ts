import fs from "fs"
import path from "path"

/**
 * Haptics follow the phone's own haptics switch on Android because of a patch to
 * react-native-haptic-feedback, which the JS mocks cannot see: upstream only checks the
 * ringer mode, so a phone with Touch feedback off still buzzed. This pins the patch to the
 * installed version (patch-package applies a patch by file name, so a bump that leaves it
 * behind would drop it), to what it does, and to the installed module having it.
 */

const ROOT = path.resolve(__dirname, "../..")
const PACKAGE_JSON = require.resolve("react-native-haptic-feedback/package.json")
const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")) as {
  version: string
}
const PATCH = path.join(ROOT, "patches", `react-native-haptic-feedback+${version}.patch`)
const MODULE = path.join(
  path.dirname(PACKAGE_JSON),
  "android/src/main/java/com/mkuczera/RNReactNativeHapticFeedbackModuleImpl.java",
)

/** The lines a patch adds to one file, without their "+" marks. */
const addedLines = (patch: string, fileSuffix: string): string[] => {
  const section = patch
    .split(/^diff --git /m)
    .find((part) => part.split("\n")[0].endsWith(fileSuffix))
  if (!section) return []
  return section
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
}

describe("the react-native-haptic-feedback native patch", () => {
  const patch = fs.existsSync(PATCH) ? fs.readFileSync(PATCH, "utf8") : ""

  it("exists for the installed version", () => {
    expect(patch).not.toBe("")
  })

  it("reads the system Touch feedback setting", () => {
    const added = addedLines(patch, "RNReactNativeHapticFeedbackModuleImpl.java").join(
      " ",
    )

    expect(added).toContain("Settings.System.HAPTIC_FEEDBACK_ENABLED")
  })

  it("drops a trigger while it is off", () => {
    const added = addedLines(patch, "RNReactNativeHapticFeedbackModuleImpl.java")

    expect(added).toContain("if (!isHapticFeedbackEnabled(reactContext)) return;")
  })

  it("is applied to the installed module, before ignoreAndroidSystemSettings is read", () => {
    const source = fs.readFileSync(MODULE, "utf8")

    expect(source).toContain("if (!isHapticFeedbackEnabled(reactContext)) return;")
    expect(source.indexOf("isHapticFeedbackEnabled(reactContext)")).toBeLessThan(
      source.indexOf('options.getBoolean("ignoreAndroidSystemSettings")'),
    )
  })
})
