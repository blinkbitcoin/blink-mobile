import { readFileSync } from "fs"

// Pinned with source-level assertions for the same reason the migration flow is: rendering
// RootNavigator would mean mocking dozens of screens and providers. The predicate itself is
// covered in stack-param-lists.spec.ts; what is worth pinning here is that the registration
// keeps asking it, since a header that quietly goes back to a static object would restore
// the back arrow for restore and migration without failing anything else.
describe("choose experience registration in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )

  /** Bounded by the next screen's registration rather than a character count, so a longer
   *  comment above the options cannot silently push an assertion out of range. */
  const registration = (() => {
    const routeIndex = navigatorSource.indexOf('name="selfCustodialChooseExperience"')
    const nextRouteIndex = navigatorSource.indexOf('name="', routeIndex + 1)
    return navigatorSource.slice(routeIndex, nextRouteIndex)
  })()

  /** The options live in a module-level factory rather than inline, so the screen's own
   *  registration is only expected to point at it; what the factory does is asserted off
   *  the source below. */
  it("takes its options from the shared factory", () => {
    expect(registration).toContain("options={chooseExperienceOptions}")
  })

  it("derives the back arrow from the entry rather than showing it unconditionally", () => {
    expect(navigatorSource).toContain("canGoBackFromChooseExperience(")
    expect(navigatorSource).toContain(
      "headerLeft: canGoBack ? defaultHeaderBack : suppressedHeaderBack",
    )
  })

  /** The navigator already supplies a custom `headerLeft`, so enabling the native back
   *  button on top of it renders a second arrow beside the first. It rendered that way on
   *  one device run, which is the only reason this is pinned. Read off the code with the
   *  comments stripped, since the comment explains the very option it must not find. */
  it("leaves the native back button alone, so the header keeps a single control", () => {
    const navigatorCode = navigatorSource.replace(/\/\*\*[\s\S]*?\*\//g, "")

    expect(navigatorCode).not.toContain("headerBackVisible: canGoBack")
  })

  /** The gesture is undirected wherever it lands, so it stays blocked for every entry,
   *  including the creation one that keeps its arrow. */
  it("keeps the swipe blocked for every entry", () => {
    expect(navigatorSource).toContain("gestureEnabled: false")
  })
})
