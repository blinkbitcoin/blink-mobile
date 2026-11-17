import fs from "fs"
import path from "path"

/**
 * The Incognito guarantee for native crashes rests on a patch to RNFB Crashlytics, which
 * the JS mocks cannot see: upstream's setCrashlyticsCollectionEnabled only stores a
 * preference the SDK picks up at the next launch, and its iOS log writes whatever the
 * switch says. This pins the patch to the installed version (patch-package applies a
 * patch by file name, so a bump that leaves it behind would drop it) and to what it does.
 */

const ROOT = path.resolve(__dirname, "../..")
const { version } = JSON.parse(
  fs.readFileSync(
    require.resolve("@react-native-firebase/crashlytics/package.json"),
    "utf8",
  ),
) as { version: string }
const PATCH = path.join(
  ROOT,
  "patches",
  `@react-native-firebase+crashlytics+${version}.patch`,
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

describe("the RNFB Crashlytics native patch", () => {
  const patch = fs.existsSync(PATCH) ? fs.readFileSync(PATCH, "utf8") : ""

  it("exists for the installed version", () => {
    expect(patch).not.toBe("")
  })

  it("hands the switch to the Android SDK in this process", () => {
    const added = addedLines(patch, "ReactNativeFirebaseCrashlyticsModule.java").join(" ")

    expect(added).toContain("FirebaseCrashlytics.getInstance()")
    expect(added).toContain(
      ".setCrashlyticsCollectionEnabled( ReactNativeFirebaseCrashlyticsInitProvider.isCrashlyticsCollectionEnabled());",
    )
  })

  it("hands the switch to the iOS SDK at once", () => {
    const added = addedLines(patch, "RNFBCrashlyticsModule.m").join(" ")

    expect(added).toContain(
      "setCrashlyticsCollectionEnabled:[RNFBCrashlyticsInitProvider isCrashlyticsCollectionEnabled]];",
    )
  })

  it("gates both iOS log methods on the switch, as Android does", () => {
    const added = addedLines(patch, "RNFBCrashlyticsModule.m")
    const gates = added.filter(
      (line) =>
        line === "if ([RNFBCrashlyticsInitProvider isCrashlyticsCollectionEnabled]) {",
    )

    expect(added).toContain("RCT_EXPORT_METHOD(log : (NSString *)message) {")
    expect(gates).toHaveLength(2)
  })
})
