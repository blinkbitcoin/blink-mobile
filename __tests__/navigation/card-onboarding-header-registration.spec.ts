import { readFileSync } from "fs"
import { join } from "path"

// Pinned with source-level assertions, like the other registrations here: rendering
// RootNavigator would mean mocking dozens of screens and providers.
describe("card onboarding header controls in root-navigator", () => {
  const navigatorSource = readFileSync(
    join(__dirname, "..", "..", "app", "navigation", "root-navigator.tsx"),
    "utf8",
  )

  /** Bounded by the next screen's registration rather than a character count, so a longer
   *  comment above the options cannot silently push an assertion out of range. */
  const registration = (route: string) => {
    const routeIndex = navigatorSource.indexOf(`name="${route}"`)
    const nextRouteIndex = navigatorSource.indexOf('name="', routeIndex + 1)
    return navigatorSource.slice(routeIndex, nextRouteIndex)
  }

  /** `headerBackVisible: false` alone hides only the native button: the navigator also
   *  draws its own back through `headerLeft`, which kept showing on these screens. */
  it("clears both back controls in one shared option set", () => {
    expect(navigatorSource).toMatch(
      /const noHeaderBack = \{\s*headerBackVisible: false,\s*headerLeft: \(\) => null,\s*\}/,
    )
  })

  it("shows only the close button on the close-only screens", () => {
    const CLOSE_ONLY_ROUTES = [
      "cardOnboardingWelcomeScreen",
      "cardOnboardingPersonalInfoScreen",
    ]

    CLOSE_ONLY_ROUTES.forEach((route) => {
      const options = registration(route)

      expect(options).toContain("...noHeaderBack")
      expect(options).toContain("...headerCloseControlOptions()")
    })
  })

  /** The wait replaced itself with the outcome over the Home, so the X pops back to that
   *  Home, as the footer does, instead of stacking a second one. */
  it("closes the outcome screens onto the Home under them", () => {
    const OUTCOME_ROUTES = [
      "cardOnboardingPreapprovedScreen",
      "cardOnboardingDeclinedScreen",
    ]

    OUTCOME_ROUTES.forEach((route) => {
      const options = registration(route)

      expect(options).toContain("...noHeaderBack")
      expect(options).toContain("...headerCloseControlOptions({ shouldPopTo: true })")
    })
  })

  it("keeps the way back next to the close button on the steps that can go back", () => {
    const BACK_AND_CLOSE_ROUTES = [
      "cardOnboardingIntroducingScreen",
      "cardOnboardingDetailsScreen",
      "cardOnboardingVerifyIdentityScreen",
    ]

    BACK_AND_CLOSE_ROUTES.forEach((route) => {
      const options = registration(route)

      expect(options).not.toContain("noHeaderBack")
      expect(options).toContain("...headerCloseControlOptions()")
    })
  })

  /** The design leaves the wait without a way back or out: it ends on its own. */
  it("leaves the processing wait without back and close buttons", () => {
    const options = registration("cardOnboardingProcessingScreen")

    expect(options).toContain("...noHeaderBack")
    expect(options).not.toContain("headerCloseControlOptions")
  })

  /** The native stack cannot refuse the swipe once it starts, so the route switches it
   *  off and the screen refuses the hardware back itself. */
  it("switches the swipe off on the processing wait", () => {
    expect(registration("cardOnboardingProcessingScreen")).toContain(
      "gestureEnabled: false",
    )
  })

  /** An unset title would fall back to the route name. */
  it("leaves the verify identity step untitled, as the design does", () => {
    expect(registration("cardOnboardingVerifyIdentityScreen")).toContain('title: ""')
  })
})
