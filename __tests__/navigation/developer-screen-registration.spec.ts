import { readFileSync } from "fs"

// Rendering the full RootNavigator would require mocking dozens of screens and
// providers, so these assertions follow the existing project pattern of
// source-text checks against the navigator file (see
// view-backup-security-checks-screen.spec.tsx). They pin the two properties
// that make the release-build gate effective: registration is conditional on
// __DEV__, and the module is not pulled in by a static import.
describe("developer screen registration in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )

  it("registers the developerScreen route only behind a __DEV__ guard", () => {
    expect(navigatorSource).toContain('name="developerScreen"')
    expect(navigatorSource).toContain("{DeveloperScreen && (")
    expect(navigatorSource).toMatch(
      /__DEV__\s*\?\s*[\s\S]*?require\("\.\.\/screens\/developer-screen"\)[\s\S]*?:\s*null/,
    )
  })

  it("does not statically import the developer screen module, so its module body never evaluates in release bundles", () => {
    expect(navigatorSource).not.toMatch(/^import\s.*developer-screen.*$/m)
  })
})
