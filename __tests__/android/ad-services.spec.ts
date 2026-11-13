/* eslint-disable camelcase */
import { it } from "@jest/globals"
import { readFileSync } from "fs"
import { join } from "path"

const REPO_ROOT = join(__dirname, "..", "..")
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8")

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const XML_COMMENT = /<!--[\s\S]*?-->/g

const codeLines = (path: string, blockComment?: RegExp) => {
  const text = read(path)
  const code = blockComment ? text.replace(blockComment, "") : text
  return code.split("\n").map((line) => line.trim())
}

const AUDITED_FIREBASE_BOM = "34.2.0"

const AD_PERMISSIONS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
]

describe("ads in the Android build", () => {
  it("turns off advertising ID collection and the ad consent defaults", () => {
    const config = JSON.parse(read("firebase.json"))["react-native"]

    expect(config).toEqual(
      expect.objectContaining({
        google_analytics_adid_collection_enabled: false,
        analytics_default_allow_ad_storage: false,
        analytics_default_allow_ad_user_data: false,
        analytics_default_allow_ad_personalization_signals: false,
      }),
    )
  })

  it("keeps the Firebase BoM the ad library audit covered, so re-audit the excluded ad libraries before changing it (see docs/android-firebase-ad-libraries.md)", () => {
    const rnfbApp = JSON.parse(read("node_modules/@react-native-firebase/app/package.json"))

    expect(rnfbApp.sdkVersions.android.firebase).toBe(AUDITED_FIREBASE_BOM)
  })

  it("leaves the ad libraries out of every configuration", () => {
    const gradle = codeLines("android/app/build.gradle", BLOCK_COMMENT)

    expect(gradle).toContain('exclude group: "androidx.privacysandbox.ads"')
    expect(gradle).toContain(
      'exclude group: "com.google.android.gms", module: "play-services-ads-identifier"',
    )
  })

  it.each(AD_PERMISSIONS)("removes the %s permission the libraries declare", (permission) => {
    expect(codeLines("android/app/src/main/AndroidManifest.xml", XML_COMMENT)).toContain(
      `<uses-permission android:name="${permission}" tools:node="remove" />`,
    )
  })

  it("tells R8 the excluded ad classes are missing on purpose", () => {
    const rules = codeLines("android/app/proguard-rules.pro")

    expect(rules).toContain("-dontwarn androidx.privacysandbox.ads.**")
    expect(rules).toContain("-dontwarn com.google.android.gms.ads.identifier.**")
  })
})
