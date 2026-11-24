import { getStateFromPath } from "@react-navigation/native"

import { DEEP_LINK_SCREENS, isCardDeepLinkPath } from "@app/navigation/deep-link-screens"

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
   * No link reaches the investment flow yet. Its entry arrives together with the check
   * of who may take part: a build that links to it without that check would let any
   * signed-in user pay into the round the day the deposit wallet is configured. Its
   * later steps take figures the signing produced and are reached from it alone; a link
   * landing on one would open it with nothing to show, or with a sum nobody agreed to.
   */
  it("links to no step of the investment flow", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingWelcomeInvestScreen")
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingTransferInvestScreen")
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingDepositPendingScreen")
  })

  /**
   * The identity step starts the card KYC, and the agreements are accepted on the
   * subscribe step before it. A link landing on it would start the KYC with none of them
   * accepted. It is reached from the subscribe step alone.
   */
  it("links to no card onboarding step that starts the KYC", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingVerifyIdentityScreen")
  })

  /**
   * The terms step sends the additional data it is handed with the card application,
   * and the wait follows the application it is handed. A crafted link would fill in the
   * application's answers, or open the wait with nothing to follow. Both are reached
   * from the step before them alone.
   */
  it("links to no card application step that acts on its params", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingAcknowledgementScreen")
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingProcessingScreen")
  })

  /**
   * The additional data step leads to the terms step, which submits the card
   * application. A link landing on it would submit one with the subscribe step's notices
   * and the card KYC both skipped. It is reached from the identity step alone, once the
   * verification is submitted.
   */
  it("links to no card onboarding step that leads to the application", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingPersonalInfoScreen")
  })

  /**
   * "We're working on your card" was dropped from the flow, and the screen with it: the
   * wait goes Home on its own after a minute. Its old link must open nothing.
   */
  it("opens nothing at the link of the dropped card waiting screen", () => {
    expect(
      getStateFromPath("card/onboarding/loading", { screens: DEEP_LINK_SCREENS }),
    ).toBeUndefined()
  })

  it("still links to the card onboarding step that shows a refusal", () => {
    expect(DEEP_LINK_SCREENS).toHaveProperty("cardOnboardingDeclinedScreen")
  })

  /**
   * The confetti screen says the card is ready. The wait opens it once the issuer has
   * approved the application, and no bulletin links to it: the approved bulletin opens
   * the card's own approved screen. A link would announce an approval nobody gave.
   */
  it("links to no card onboarding step that announces an approval", () => {
    expect(DEEP_LINK_SCREENS).not.toHaveProperty("cardOnboardingPreapprovedScreen")
  })

  /**
   * The declined bulletin opens this path: core's notifications send it for the
   * declined deep link screen, so renaming it here would leave the bulletin opening
   * nothing.
   */
  it("links the declined screen at the path the declined bulletin opens", () => {
    expect(DEEP_LINK_SCREENS.cardOnboardingDeclinedScreen).toBe(
      "card/onboarding/declined",
    )
  })

  /**
   * The code screen and the backup take the setup key as a param. A link landing on
   * either would show a key the registration never issued, and offer to save it as the
   * account's. The registration is reached from its own start alone.
   */
  it("links to no step of the authenticator registration that carries the setup key", () => {
    const routeNames = collectRouteNames(DEEP_LINK_SCREENS as ScreenConfig)
    expect(routeNames).not.toContain("totpRegistrationValidate")
    expect(routeNames).not.toContain("totpRegistrationBackup")
  })
})

describe("isCardDeepLinkPath", () => {
  /** Every route with a path of its own, nested navigators included. */
  const collectRoutePaths = (screens: ScreenConfig): [string, string][] =>
    Object.entries(screens).flatMap(([name, value]) => {
      const config = (typeof value === "string" ? { path: value } : value) as {
        path?: string
        screens?: ScreenConfig
      }
      const own: [string, string][] =
        config.path === undefined ? [] : [[name, config.path]]
      const nested = config.screens ? collectRoutePaths(config.screens) : []
      return [...own, ...nested]
    })
  const routePaths = collectRoutePaths(DEEP_LINK_SCREENS as ScreenConfig)

  /** Non-custodial mode drops these links; a card route left out would still open. */
  it("covers every card route that can be linked to", () => {
    const cardPaths = routePaths.filter(([name]) => name.startsWith("card"))

    expect(cardPaths.length).toBeGreaterThan(0)
    cardPaths.forEach(([, path]) => expect(isCardDeepLinkPath(path)).toBe(true))
  })

  it("leaves every other linked route out", () => {
    routePaths
      .filter(([name]) => !name.startsWith("card"))
      .forEach(([, path]) => expect(isCardDeepLinkPath(path)).toBe(false))
  })

  it("reads the path with a leading slash or a query as well", () => {
    expect(isCardDeepLinkPath("/card/onboarding")).toBe(true)
    expect(isCardDeepLinkPath("card?ref=bulletin")).toBe(true)
  })

  it("does not take a path that only starts with the same letters", () => {
    expect(isCardDeepLinkPath("cards")).toBe(false)
    expect(isCardDeepLinkPath("cardano/payment")).toBe(false)
  })
})
