import { DEEP_LINK_SCREENS } from "@app/navigation/deep-link-screens"

/**
 * The webView route's `allowArbitraryUrl` param bypasses the WebView entry-origin
 * allowlist (see stack-param-lists.ts). That is only safe while no deep link can
 * reach the route: a crafted `blink://…` URL carrying the param would otherwise
 * load an attacker origin in the trusted WebView, WebLN bridge included.
 *
 * These tests fail the moment someone makes the route deep-linkable, which is the
 * signal to re-derive the bypass rather than to delete the assertion.
 */

type ScreenConfig = Record<string, unknown>

const collectRouteNames = (screens: ScreenConfig): string[] =>
  Object.entries(screens).flatMap(([name, value]) => {
    const nested =
      value && typeof value === "object" && "screens" in value
        ? collectRouteNames((value as { screens: ScreenConfig }).screens)
        : []
    return [name, ...nested]
  })

describe("deep-linkable routes", () => {
  it("does not expose the webView route at the top level", () => {
    expect(Object.keys(DEEP_LINK_SCREENS)).not.toContain("webView")
  })

  it("does not expose the webView route nested under any navigator", () => {
    expect(collectRouteNames(DEEP_LINK_SCREENS as ScreenConfig)).not.toContain("webView")
  })

  it("still exposes the routes deep links depend on", () => {
    // Guards the traversal itself: a helper that silently returned nothing would
    // make the assertions above vacuous.
    const routeNames = collectRouteNames(DEEP_LINK_SCREENS as ScreenConfig)
    expect(routeNames).toContain("Home")
    expect(routeNames).toContain("circlesDashboard")
    expect(routeNames).toContain("sendBitcoinDestination")
  })
})
