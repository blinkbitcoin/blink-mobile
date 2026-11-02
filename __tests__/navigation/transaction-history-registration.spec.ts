import { readFileSync } from "fs"

// Rendering the full RootNavigator would require mocking dozens of screens and providers,
// so the history route's options are pinned with source-level assertions instead, scoped
// to that route's <RootNavigator.Screen> block.
describe("transaction history registration in root-navigator", () => {
  const navigatorSource = readFileSync(
    require.resolve("@app/navigation/root-navigator"),
    "utf8",
  )

  const routeBlock = (() => {
    const nameIndex = navigatorSource.indexOf('name="transactionHistory"')
    const end = navigatorSource.indexOf("/>", nameIndex)
    return navigatorSource.slice(nameIndex, end)
  })()

  it("registers the transactionHistory route", () => {
    expect(routeBlock).toContain("component={TransactionHistoryScreen}")
  })

  it("uses fade_from_bottom, which closes in 250ms on Android instead of slide_from_bottom's 400ms", () => {
    expect(routeBlock).toContain('animation: "fade_from_bottom"')
    expect(routeBlock).not.toContain('animation: "slide_from_bottom"')
  })

  it("stays a modal with the swipe disabled", () => {
    expect(routeBlock).toContain('presentation: "modal"')
    expect(routeBlock).toContain("gestureEnabled: false")
  })
})
