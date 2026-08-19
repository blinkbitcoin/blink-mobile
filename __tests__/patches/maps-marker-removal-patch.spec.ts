import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/**
 * Pins the react-native-maps marker-removal patch so it cannot silently stop
 * applying on a dependency bump. The artifact under test is a source patch, so
 * source-coupling here is intentional.
 *
 * `MapView.features` mirrors the view's children one-for-one — `getFeatureCount`
 * reports its size, `getFeatureAt` answers `getChildAt`, and `removeFeatureAt`
 * removes by index, shifting. `safeAddFeature` used `features.set(index, …)`,
 * which overwrites rather than inserts, so any insert that was not at the end
 * dropped the feature already at that index: its Google marker stayed on the map
 * with nothing able to remove it, and every later index was off by one.
 *
 * On this map that is the category filter — the pins change without the camera
 * moving, so the stale markers are plainly visible and the filter looks broken.
 *
 * Upstream: https://github.com/react-native-maps/react-native-maps/issues/5977
 * A release containing that fix is the exit criterion for deleting this patch.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const PKG = "react-native-maps"

const installedVersion = (): string =>
  JSON.parse(readFileSync(join(REPO_ROOT, "node_modules", PKG, "package.json"), "utf8"))
    .version

const patchVersion = (): string => {
  const file = readdirSync(join(REPO_ROOT, "patches")).find(
    (name) => name.startsWith(`${PKG}+`) && name.endsWith(".patch"),
  )
  if (!file) throw new Error(`No patch file found for ${PKG}`)
  return file.slice(`${PKG}+`.length, -".patch".length)
}

const mapViewSource = (): string =>
  readFileSync(
    join(
      REPO_ROOT,
      "node_modules",
      PKG,
      "android/src/main/java/com/rnmaps/maps/MapView.java",
    ),
    "utf8",
  )

const safeAddFeatureBody = (): string => {
  const source = mapViewSource()
  const start = source.indexOf("private void safeAddFeature(")
  if (start < 0) throw new Error("safeAddFeature not found — did the method move?")
  const end = source.indexOf("public void addFeature(", start)
  return source.slice(start, end)
}

describe("react-native-maps marker-removal patch", () => {
  it("targets the installed package version (bumping the dep without re-pinning fails here)", () => {
    expect(patchVersion()).toBe(installedVersion())
  })

  it("inserts a feature at its index rather than overwriting whatever is there", () => {
    const body = safeAddFeatureBody()

    expect(body).toContain("features.add(index, mapFeature)")
    expect(body).toContain("savedFeatures.add(index, mapFeature)")
    expect(body).not.toContain("features.set(index, mapFeature)")
    expect(body).not.toContain("savedFeatures.set(index, mapFeature)")
  })

  it("stops padding one slot too far, which would leave a null between features", () => {
    // With `set` the list had to be grown *past* the index; with `add` growing
    // that far would insert the new feature after a stray null.
    const body = safeAddFeatureBody()

    expect(body).toContain("while(features.size() < index)")
    expect(body).toContain("while(savedFeatures.size() < index)")
    expect(body).not.toContain("<= index")
  })

  it("still removes by the same index it added by", () => {
    // The two halves are only correct together: shifting removal against
    // overwriting insertion is what desynchronised the list in the first place.
    expect(mapViewSource()).toContain("features.remove(index)")
  })
})
