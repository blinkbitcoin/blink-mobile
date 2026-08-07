import { readFileSync } from "fs"

// Rendering the full RootNavigator would require mocking dozens of screens and
// providers (and even a bare require of it trips module-scope side effects in
// the jest environment), so the release-build gate is pinned with source-level
// assertions instead — at the specifier level rather than exact source text,
// so behavior-preserving rewrites of the guard (ternary vs &&, renaming the
// const) keep passing while every way of re-introducing the module into
// release bundles (static import, re-export, unguarded require) fails.
describe("developer screen registration in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )
  const SPECIFIER = '"../screens/developer-screen"'

  it("references the developer screen module exactly once, and only via require, so no static import or re-export can pull it into release bundles", () => {
    const occurrences = navigatorSource.split(SPECIFIER).length - 1
    expect(occurrences).toBe(1)
    expect(navigatorSource).toContain(`require(${SPECIFIER})`)
  })

  it("guards that require with __DEV__ in the same declaration", () => {
    const requireIndex = navigatorSource.indexOf(`require(${SPECIFIER})`)
    const declarationStart = navigatorSource.lastIndexOf("\nconst ", requireIndex)
    expect(declarationStart).toBeGreaterThan(-1)
    expect(navigatorSource.slice(declarationStart, requireIndex)).toContain("__DEV__")
  })

  it("registers the developerScreen route", () => {
    expect(navigatorSource).toContain('name="developerScreen"')
  })
})
