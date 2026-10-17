import { readFileSync } from "fs"

/** The gate wraps the tabs inside PrimaryNavigator, which no spec renders: doing so
 *  would mean mocking dozens of screens and providers. Pinned at source level, the same
 *  way the migration flow's registration is, so the wrap and the absence of a route for
 *  the protection screen cannot drift without a spec saying so. */
describe("two-factor gate in the primary navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )
  const primarySource = navigatorSource.slice(
    navigatorSource.indexOf("export const PrimaryNavigator"),
  )

  it("wraps the tabs in the home gate, which decides what stands in for them", () => {
    const gateOpen = primarySource.indexOf("<HomeGate>")
    const tabsOpen = primarySource.indexOf("<Tab.Navigator")
    const tabsClose = primarySource.indexOf("</Tab.Navigator>")
    const gateClose = primarySource.indexOf("</HomeGate>")

    expect(gateOpen).toBeGreaterThan(-1)
    expect(tabsOpen).toBeGreaterThan(gateOpen)
    expect(tabsClose).toBeGreaterThan(tabsOpen)
    expect(gateClose).toBeGreaterThan(tabsClose)
  })

  it("registers no route for the protection screen, so nothing can push it over a home already shown", () => {
    expect(navigatorSource).not.toContain('name="twoFactorProtectionRequired"')
    expect(navigatorSource).not.toContain("TwoFactorProtectionRequiredScreen")
  })
})
