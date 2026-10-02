import { readFileSync } from "fs"

/**
 * Rendering the full RootNavigator would require mocking dozens of screens and
 * providers (and even a bare require of it trips module-scope side effects in
 * the jest environment), so the route a launch starts on is pinned with a
 * source-level assertion instead, the same way the navigator's registrations
 * are.
 */
describe("where a launch starts in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )

  /** The first `initialRouteName` after the root navigator opens is its own; the
   *  ones further down belong to the tab and people navigators. */
  const rootNavigator = navigatorSource.slice(
    navigatorSource.indexOf("<RootNavigator.Navigator"),
  )
  const initialRoute = rootNavigator.match(/initialRouteName=(\{[^}]*\}|"[^"]*")/)?.[1]

  it("starts every launch at the gate, with an account or without", () => {
    /** A launch that opened on the landing screen for a device without an account
     *  put that screen in front of a lock that could still be set. A new account
     *  can be opened from it with no credentials, and it lists every wallet the
     *  device stores. A condition here, of any kind, is that door coming back. */
    expect(initialRoute).toBe('"authenticationCheck"')
  })

  it("still registers the landing screen the gate hands a device with no account to", () => {
    expect(navigatorSource).toContain('name="getStarted"')
  })
})
