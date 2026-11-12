/* eslint-disable camelcase */
import { it } from "@jest/globals"
import { readFileSync } from "fs"
import { join } from "path"

const REPO_ROOT = join(__dirname, "..", "..")
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8")

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
        analytics_default_allow_ad_personalization_signals: false,
      }),
    )
  })

  it("leaves the ad libraries out of every configuration", () => {
    const excluded = /\nconfigurations\.all \{([\s\S]*?)\n\}/.exec(
      read("android/app/build.gradle"),
    )?.[1]

    expect(excluded).toContain('exclude group: "androidx.privacysandbox.ads"')
    expect(excluded).toContain(
      'exclude group: "com.google.android.gms", module: "play-services-ads-identifier"',
    )
  })

  it.each(AD_PERMISSIONS)("removes the %s permission the libraries declare", (permission) => {
    expect(read("android/app/src/main/AndroidManifest.xml")).toContain(
      `<uses-permission android:name="${permission}" tools:node="remove" />`,
    )
  })

  it("lets R8 shrink the release build without the excluded classes", () => {
    const rules = read("android/app/proguard-rules.pro")

    expect(rules).toContain("-dontwarn androidx.privacysandbox.ads.**")
    expect(rules).toContain("-dontwarn com.google.android.gms.ads.identifier.**")
  })
})
