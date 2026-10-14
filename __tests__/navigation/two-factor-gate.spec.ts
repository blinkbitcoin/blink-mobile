import { readFileSync } from "fs"

// The gate is a pair of early returns inside PrimaryNavigator, which no spec renders:
// doing so would mean mocking dozens of screens and providers. Pinned at source level,
// the same way the migration flow's registration is, so the precedence and the absence
// of the old route cannot drift without a spec saying so.
describe("two-factor gate in the primary navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )
  const primarySource = navigatorSource.slice(
    navigatorSource.indexOf("export const PrimaryNavigator"),
  )

  it("stands the protection screen in for the home, after the wind-down gate and before the tabs", () => {
    const windDownGate = primarySource.indexOf("if (migrationBlocker.isVisible)")
    const preparing = primarySource.indexOf(
      "if (twoFactor.isPreparingSessionStart) return null",
    )
    const gate = primarySource.indexOf("if (twoFactor.isProtectionGateActive)")
    const tabs = primarySource.indexOf("<Tab.Navigator")

    expect(windDownGate).toBeGreaterThan(-1)
    expect(preparing).toBeGreaterThan(windDownGate)
    expect(gate).toBeGreaterThan(preparing)
    expect(primarySource.slice(gate, tabs)).toContain(
      "<TwoFactorProtectionRequiredScreen />",
    )
    expect(tabs).toBeGreaterThan(gate)
  })

  it("registers no route for the protection screen, so nothing can push it over a home already shown", () => {
    expect(navigatorSource).not.toContain('name="twoFactorProtectionRequired"')
  })
})
