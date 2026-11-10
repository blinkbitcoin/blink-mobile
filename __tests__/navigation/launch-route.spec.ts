import { readFileSync } from "fs"

import { LAUNCH_ROUTE } from "@app/navigation/unlock-routes"

/**
 * Rendering the full RootNavigator would require mocking dozens of screens and
 * providers (and even a bare require of it trips module-scope side effects in
 * the jest environment). What a launch does from its first route is rendered in
 * the spent-budget journey, which launches from `LAUNCH_ROUTE`; this only pins
 * that the real navigator starts on that same constant, unconditionally.
 */
describe("where a launch starts", () => {
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

  it("is the gate, with an account or without", () => {
    /** A launch that opened on the landing screen for a device without an account
     *  put that screen in front of a lock that could still be set. */
    expect(LAUNCH_ROUTE).toBe("authenticationCheck")
  })

  it("is what the root navigator starts on, with no condition around it", () => {
    /** A condition here, of any kind, is that door coming back. */
    expect(initialRoute).toBe("{LAUNCH_ROUTE}")
  })

  it("still registers the landing screen the gate hands a device with no account to", () => {
    expect(navigatorSource).toContain('name="getStarted"')
  })
})
