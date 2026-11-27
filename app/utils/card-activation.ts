import { CardActivationStep } from "@app/graphql/generated"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

/** What places a member in the activation flow: where blink-card says they are, and
 *  what has already happened to their cards. */
export type CardActivationFacts = {
  step: CardActivationStep
  isSetupComplete: boolean
  /** The card the app shows, the newest, has its PIN: a physical card ordered during
   *  the flow comes without one. */
  isPinSet: boolean
  hasPhysicalCard: boolean
  /** A card of the member's is in Apple Pay or Google Pay, as the app told blink-card. */
  isWalletAdded: boolean
}

export const ACTIVATION_DONE = "DONE"

export type ActivationPlace = CardActivationStep | typeof ACTIVATION_DONE

const STEP_ORDER: readonly CardActivationStep[] = [
  CardActivationStep.Activated,
  CardActivationStep.Pin,
  CardActivationStep.OfferOtherWay,
  CardActivationStep.BalanceUnit,
  CardActivationStep.TopUp,
]

/** A step is passed over once what it asks for has happened. The two ways to use the card
 *  are the physical card and the wallet: either settles the first way, and the other way
 *  is settled once both are taken. The balance unit is passed over until the Card Balance
 *  can be held in dollars. */
export const isStepDone = (
  step: CardActivationStep,
  facts: CardActivationFacts,
): boolean => {
  const hasTakenEitherWay = facts.hasPhysicalCard || facts.isWalletAdded
  const hasTakenBothWays = facts.hasPhysicalCard && facts.isWalletAdded

  switch (step) {
    case CardActivationStep.Activated:
      return hasTakenEitherWay
    case CardActivationStep.OfferOtherWay:
      return hasTakenBothWays
    case CardActivationStep.Pin:
      return facts.isPinSet
    case CardActivationStep.BalanceUnit:
      return true
    case CardActivationStep.TopUp:
      return false
  }
}

const PIN_INDEX = STEP_ORDER.indexOf(CardActivationStep.Pin)

/**
 * Where the member belongs: their step, or the first one after it still open. The steps
 * behind them stay behind, except the PIN: a physical card ordered after it becomes the
 * card the app shows, and that card still needs a PIN of its own.
 */
export const activationPlace = (facts: CardActivationFacts): ActivationPlace => {
  if (facts.isSetupComplete) return ACTIVATION_DONE

  const lastIndex = STEP_ORDER.length - 1
  const stepIndex = STEP_ORDER.indexOf(facts.step)
  const isPinStillOwed = stepIndex > PIN_INDEX && !facts.isPinSet
  let index = isPinStillOwed ? PIN_INDEX : stepIndex
  while (index < lastIndex && isStepDone(STEP_ORDER[index], facts)) index += 1
  return STEP_ORDER[index]
}

/** The top-up is the last step: only completing the activation takes a member past it. */
export const stepAfter = (step: CardActivationStep): CardActivationStep => {
  const index = STEP_ORDER.indexOf(step)
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]
}

const isStepBefore = (step: CardActivationStep, place: CardActivationStep): boolean =>
  STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(place)

type ActivationScreen = keyof Pick<
  RootStackParamList,
  | "cardOnboardingApprovedScreen"
  | "cardCreatePinScreen"
  | "cardActivationOrderOfferScreen"
  | "cardActivationWalletOfferScreen"
  | "cardActivationTopUpScreen"
  | "cardDashboardScreen"
>

const PLACE_SCREEN: Record<ActivationPlace, ActivationScreen> = {
  [CardActivationStep.Activated]: "cardOnboardingApprovedScreen",
  [CardActivationStep.Pin]: "cardCreatePinScreen",
  [CardActivationStep.OfferOtherWay]: "cardActivationOrderOfferScreen",
  [CardActivationStep.BalanceUnit]: "cardActivationTopUpScreen",
  [CardActivationStep.TopUp]: "cardActivationTopUpScreen",
  [ACTIVATION_DONE]: "cardDashboardScreen",
}

/** The step each step screen stands for. The balance unit has no screen of its own yet,
 *  so the top-up screen is only ever the top-up step. */
const SCREEN_STEP: Partial<Record<string, CardActivationStep>> = {
  cardOnboardingApprovedScreen: CardActivationStep.Activated,
  cardCreatePinScreen: CardActivationStep.Pin,
  cardActivationOrderOfferScreen: CardActivationStep.OfferOtherWay,
  cardActivationWalletOfferScreen: CardActivationStep.OfferOtherWay,
  cardActivationTopUpScreen: CardActivationStep.TopUp,
}

/** Screens the flow passes on its way: the physical order, its confirmation, and the
 *  dashboard a guard sends back into the flow. */
const PASSED_SCREENS: ReadonlySet<string> = new Set([
  "orderCardScreen",
  "cardStatusScreen",
  "cardDashboardScreen",
])

const isFlowScreen = (name: string): boolean =>
  SCREEN_STEP[name] !== undefined || PASSED_SCREENS.has(name)

/** The other way is offered as the one not taken: the wallet once the physical card is
 *  ordered, and the physical card otherwise. */
export const activationScreen = (
  place: ActivationPlace,
  facts: CardActivationFacts,
): ActivationScreen => {
  const isWalletTheOtherWay =
    place === CardActivationStep.OfferOtherWay && facts.hasPhysicalCard
  if (isWalletTheOtherWay) return "cardActivationWalletOfferScreen"
  return PLACE_SCREEN[place]
}

type StackRoute = { name: string; key?: string }

type FlowDestination<Route extends StackRoute> = {
  route: Route
  place: ActivationPlace
  facts: CardActivationFacts
}

/**
 * The stack that shows `route` to a member at `place`. The flow's screens on top give
 * way to it: a step screen stays only while its step is still open and comes before
 * `place`, so going back lands on a step the member can still take, never on a PIN set
 * or a card ordered, and the screens passed on the way go. Whatever lies under the flow
 * stays as it is.
 */
export const routesTo = <Route extends StackRoute>(
  routes: readonly Route[],
  { route, place, facts }: FlowDestination<Route>,
): Route[] => {
  let flowStart = routes.length
  while (flowStart > 0 && isFlowScreen(routes[flowStart - 1].name)) flowStart -= 1

  const underFlow = routes.slice(0, flowStart)
  if (place === ACTIVATION_DONE) return [...underFlow, route]

  const openSteps = routes.slice(flowStart).filter(({ name }) => {
    const step = SCREEN_STEP[name]
    if (step === undefined) return false
    return isStepBefore(step, place) && !isStepDone(step, facts)
  })

  return [...underFlow, ...openSteps, route]
}
