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

  /**
   * A published path is a promise: the notification service emits this string, and a
   * rename lands as a dead link in the phone of anyone holding an older notification.
   * It is also a sibling of the rest of the card onboarding, and hangs under it. The
   * entry arrives here, with the check of who may take part and the record of what was
   * signed, and not before: a build that linked to the flow without them would let any
   * signed-in user pay into the round the day the deposit wallet is configured.
   */
  it("keeps the investment entry under the card onboarding tree", () => {
    expect(DEEP_LINK_SCREENS.cardOnboardingWelcomeInvestScreen).toBe(
      "card/onboarding/investment",
    )
  })

  /** The flow is entered at its first screen only. Its later steps take figures the
   *  signing produced and are reached from it, or from the home once signed; a link
   *  landing on one would open it with nothing to show, or with a sum nobody agreed to. */
  it("links to no step of the investment flow past its entry", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingTransferInvestScreen")
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingDepositPendingScreen")
  })
})
