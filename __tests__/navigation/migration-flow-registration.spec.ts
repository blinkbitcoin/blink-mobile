import { readFileSync } from "fs"

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

  it("gives the merchant tools screen the header the flow's other steps use, so it gets a back arrow", () => {
    const routeIndex = navigatorSource.indexOf('name="accountMigrationMerchantTools"')
    const registration = navigatorSource.slice(routeIndex, routeIndex + 200)

    expect(registration).toContain("component={MigrationMerchantToolsScreen}")
    expect(registration).toContain('options={{ title: "" }}')
  })
})
