import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/**
 * Pins the credentials-manager patch so it cannot silently stop applying on a
 * dependency bump. The artifact under test is a source patch, so source-coupling
 * here is intentional.
 * Upstream: https://github.com/benjamineruvieru/react-native-credentials-manager/issues/23
 */

const REPO_ROOT = join(__dirname, "..", "..")
const PKG = "react-native-credentials-manager"

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

const newarchModule = (): string =>
  readFileSync(
    join(
      REPO_ROOT,
      "node_modules",
      PKG,
      "android/src/newarch/java/com/credentialsmanager/CredentialsManagerModule.kt",
    ),
    "utf8",
  )

describe("react-native-credentials-manager patch", () => {
  it("targets the installed package version (bumping the dep without re-pinning fails here)", () => {
    expect(patchVersion()).toBe(installedVersion())
  })

  it("applied the WritableMap fix to signUpWithPassword (no raw promise.resolve(mapOf))", () => {
    const source = newarchModule()
    expect(source).toContain("Arguments.createMap()")
    expect(source).not.toMatch(/promise\.resolve\(\s*mapOf/)
  })
})
