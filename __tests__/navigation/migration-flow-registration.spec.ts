import { readFileSync } from "fs"

import { isMigrationRoute } from "@app/navigation/migration-routes"

// The flow's screens navigate to each other by route name, and every screen spec mocks
// navigation, so a route that was never registered still passes everywhere else and only
// fails on device. Pinned with source-level assertions for the same reason the developer
// screen is: rendering RootNavigator would mean mocking dozens of screens and providers.
describe("migration flow registration in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )

  const FLOW_ROUTES = [
    "accountMigrationKeepReceiving",
    "accountMigrationMerchantTools",
    "accountMigrationDownloadHistory",
  ]

  it("registers every step of the flow", () => {
    FLOW_ROUTES.forEach((route) => {
      expect(navigatorSource).toContain(`name="${route}"`)
    })
  })

  it("keeps every registered migration screen inside the armed gate's allowance", () => {
    /** The armed-gate reset pops whatever it does not recognise as the gate's own, and an
     *  enumerated allowance is exactly what went wrong there: it named the deeplink entry
     *  and missed the screens the gate opens itself. Read off the navigator so a screen
     *  registered later is covered without anyone remembering to add it. */
    const registeredRoutes = [
      ...navigatorSource.matchAll(/name="(accountMigration\w+)"/g),
    ].map(([, routeName]) => routeName)

    expect(registeredRoutes.length).toBeGreaterThan(FLOW_ROUTES.length)
    registeredRoutes.forEach((routeName) => {
      expect(isMigrationRoute(routeName)).toBe(true)
    })
  })

  it("gives the merchant tools screen the header the flow's other steps use, so it gets a back arrow", () => {
    const routeIndex = navigatorSource.indexOf('name="accountMigrationMerchantTools"')
    const registration = navigatorSource.slice(routeIndex, routeIndex + 200)

    expect(registration).toContain("component={MigrationMerchantToolsScreen}")
    expect(registration).toContain('options={{ title: "" }}')
  })
})
