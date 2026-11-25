import { CardActivationStep } from "@app/graphql/generated"
import {
  ACTIVATION_DONE,
  CardActivationFacts,
  activationPlace,
  activationScreen,
  isStepDone,
  routesTo,
  stepAfter,
} from "@app/utils/card-activation"

const factsWith = (
  overrides: Partial<CardActivationFacts> = {},
): CardActivationFacts => ({
  step: CardActivationStep.Activated,
  isSetupComplete: false,
  isPinSet: false,
  hasPhysicalCard: false,
  ...overrides,
})

const route = (name: string, key = `${name}-key`) => ({ name, key })

describe("isStepDone", () => {
  it("settles the first way and the other way with a physical card", () => {
    const withCard = factsWith({ hasPhysicalCard: true })

    expect(isStepDone(CardActivationStep.Activated, withCard)).toBe(true)
    expect(isStepDone(CardActivationStep.OfferOtherWay, withCard)).toBe(true)
    expect(isStepDone(CardActivationStep.Activated, factsWith())).toBe(false)
    expect(isStepDone(CardActivationStep.OfferOtherWay, factsWith())).toBe(false)
  })

  it("settles the PIN once the shown card has one", () => {
    expect(isStepDone(CardActivationStep.Pin, factsWith({ isPinSet: true }))).toBe(true)
    expect(isStepDone(CardActivationStep.Pin, factsWith())).toBe(false)
  })

  it("always passes over the balance unit and never the top-up", () => {
    const everythingDone = factsWith({ hasPhysicalCard: true, isPinSet: true })

    expect(isStepDone(CardActivationStep.BalanceUnit, factsWith())).toBe(true)
    expect(isStepDone(CardActivationStep.TopUp, everythingDone)).toBe(false)
  })
})

describe("activationPlace", () => {
  it("is the end once the setup is complete, wherever the step is", () => {
    const facts = factsWith({ isSetupComplete: true, step: CardActivationStep.Pin })

    expect(activationPlace(facts)).toBe(ACTIVATION_DONE)
  })

  it("is the member's step while it is still open", () => {
    expect(activationPlace(factsWith())).toBe(CardActivationStep.Activated)
    expect(activationPlace(factsWith({ step: CardActivationStep.Pin }))).toBe(
      CardActivationStep.Pin,
    )
  })

  it("passes over the steps already taken", () => {
    const orderedWithoutPin = factsWith({ hasPhysicalCard: true })
    const pinWithoutCard = factsWith({ step: CardActivationStep.Pin, isPinSet: true })

    expect(activationPlace(orderedWithoutPin)).toBe(CardActivationStep.Pin)
    expect(activationPlace(pinWithoutCard)).toBe(CardActivationStep.OfferOtherWay)
  })

  it("ends on the top-up, which is only ever skipped", () => {
    const allTaken = factsWith({ hasPhysicalCard: true, isPinSet: true })

    expect(activationPlace(allTaken)).toBe(CardActivationStep.TopUp)
    expect(
      activationPlace(
        factsWith({ step: CardActivationStep.BalanceUnit, isPinSet: true }),
      ),
    ).toBe(CardActivationStep.TopUp)
    expect(
      activationPlace(factsWith({ step: CardActivationStep.TopUp, isPinSet: true })),
    ).toBe(CardActivationStep.TopUp)
  })

  it("never walks back to a step before the member's", () => {
    const facts = factsWith({ step: CardActivationStep.OfferOtherWay, isPinSet: true })

    expect(activationPlace(facts)).toBe(CardActivationStep.OfferOtherWay)
  })

  it("goes back to the PIN for a physical card ordered after it", () => {
    const orderedAfterPin = factsWith({
      step: CardActivationStep.OfferOtherWay,
      hasPhysicalCard: true,
    })

    expect(activationPlace(orderedAfterPin)).toBe(CardActivationStep.Pin)
    expect(activationPlace({ ...orderedAfterPin, step: CardActivationStep.TopUp })).toBe(
      CardActivationStep.Pin,
    )
  })
})

describe("stepAfter", () => {
  it("is the next step in the flow", () => {
    expect(stepAfter(CardActivationStep.Activated)).toBe(CardActivationStep.Pin)
    expect(stepAfter(CardActivationStep.Pin)).toBe(CardActivationStep.OfferOtherWay)
    expect(stepAfter(CardActivationStep.OfferOtherWay)).toBe(
      CardActivationStep.BalanceUnit,
    )
    expect(stepAfter(CardActivationStep.BalanceUnit)).toBe(CardActivationStep.TopUp)
  })

  it("stays on the top-up, the last step", () => {
    expect(stepAfter(CardActivationStep.TopUp)).toBe(CardActivationStep.TopUp)
  })
})

describe("activationScreen", () => {
  it("names the screen of each place", () => {
    expect(activationScreen(CardActivationStep.Activated)).toBe(
      "cardOnboardingApprovedScreen",
    )
    expect(activationScreen(CardActivationStep.Pin)).toBe("cardCreatePinScreen")
    expect(activationScreen(CardActivationStep.OfferOtherWay)).toBe(
      "cardActivationOrderOfferScreen",
    )
    expect(activationScreen(CardActivationStep.BalanceUnit)).toBe(
      "cardActivationTopUpScreen",
    )
    expect(activationScreen(CardActivationStep.TopUp)).toBe("cardActivationTopUpScreen")
    expect(activationScreen(ACTIVATION_DONE)).toBe("cardDashboardScreen")
  })
})

describe("routesTo", () => {
  const home = route("Primary")
  const approved = route("cardOnboardingApprovedScreen")
  const pin = route("cardCreatePinScreen")
  const orderOffer = route("cardActivationOrderOfferScreen")
  const topUp = route("cardActivationTopUpScreen")

  it("puts the route on top of what lies under the flow", () => {
    const next = { name: "cardOnboardingApprovedScreen" }

    const routes = routesTo([home], {
      route: next,
      place: CardActivationStep.Activated,
      facts: factsWith(),
    })

    expect(routes).toEqual([home, next])
  })

  it("keeps a skipped step before the place, so going back lands on it", () => {
    const next = { name: "cardCreatePinScreen" }

    const routes = routesTo([home, approved], {
      route: next,
      place: CardActivationStep.Pin,
      facts: factsWith({ step: CardActivationStep.Pin }),
    })

    expect(routes).toEqual([home, approved, next])
    expect(routes[1]).toBe(approved)
  })

  it("drops a step already taken, so going back never offers it again", () => {
    const next = { name: "cardActivationOrderOfferScreen" }

    const routes = routesTo([home, approved, pin], {
      route: next,
      place: CardActivationStep.OfferOtherWay,
      facts: factsWith({ step: CardActivationStep.OfferOtherWay, isPinSet: true }),
    })

    expect(routes).toEqual([home, approved, next])
  })

  it("drops the screens passed on the way and the steps the order settled", () => {
    const next = { name: "cardStatusScreen" }
    const stack = [home, approved, orderOffer, route("orderCardScreen")]

    const routes = routesTo(stack, {
      route: next,
      place: CardActivationStep.Pin,
      facts: factsWith({ hasPhysicalCard: true }),
    })

    expect(routes).toEqual([home, next])
  })

  it("drops a step screen at or after the place", () => {
    const next = { name: "cardCreatePinScreen" }

    const routes = routesTo([home, topUp], {
      route: next,
      place: CardActivationStep.Pin,
      facts: factsWith({ step: CardActivationStep.Pin }),
    })

    expect(routes).toEqual([home, next])
  })

  it("replaces the dashboard a guard sends back into the flow", () => {
    const next = { name: "cardActivationTopUpScreen" }

    const routes = routesTo([home, route("cardDashboardScreen")], {
      route: next,
      place: CardActivationStep.TopUp,
      facts: factsWith({ step: CardActivationStep.TopUp }),
    })

    expect(routes).toEqual([home, next])
  })

  it("leaves none of the flow's screens at the end", () => {
    const next = { name: "cardDashboardScreen" }

    const routes = routesTo([home, approved, orderOffer, topUp], {
      route: next,
      place: ACTIVATION_DONE,
      facts: factsWith({ step: CardActivationStep.TopUp }),
    })

    expect(routes).toEqual([home, next])
  })

  it("only gives way on the flow's screens at the top of the stack", () => {
    const history = route("transactionHistory")
    const next = { name: "cardActivationTopUpScreen" }

    const routes = routesTo([home, approved, history, topUp], {
      route: next,
      place: CardActivationStep.TopUp,
      facts: factsWith({ step: CardActivationStep.TopUp }),
    })

    expect(routes).toEqual([home, approved, history, next])
  })
})
