import { useCallback, useMemo, useRef } from "react"
import { ApolloCache, gql } from "@apollo/client"
import { CommonActions, useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import {
  CardActivationQuery,
  CardActivationStep,
  CardType,
  useCardActivationCompleteMutation,
  useCardActivationQuery,
  useCardActivationStepUpdateMutation,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  ACTIVATION_DONE,
  ActivationPlace,
  CardActivationFacts,
  activationPlace,
  activationScreen,
  isStepDone,
  routesTo,
  stepAfter,
} from "@app/utils/card-activation"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { toastShow } from "@app/utils/toast"

gql`
  query cardActivation {
    me {
      id
      defaultAccount {
        id
        ... on ConsumerAccount {
          cardActivation {
            step
            setupCompletedAt
          }
          cards {
            id
            cardType
            pinSetAt
            walletAddedAt
          }
        }
      }
    }
  }

  mutation cardActivationStepUpdate($input: CardActivationStepUpdateInput!) {
    cardActivationStepUpdate(input: $input) {
      step
      setupCompletedAt
    }
  }

  mutation cardActivationComplete {
    cardActivationComplete {
      step
      setupCompletedAt
    }
  }
`

type ActivationAccount = NonNullable<CardActivationQuery["me"]>["defaultAccount"]
type Activation = NonNullable<ActivationAccount["cardActivation"]>
type FlowRoute = { name: keyof RootStackParamList; params?: object; key?: string }
type LearnedFacts = Partial<
  Pick<CardActivationFacts, "isPinSet" | "hasPhysicalCard" | "isWalletAdded">
>
type OrderPlacedParams = RootStackParamList["cardStatusScreen"]

/** The facts of a member whose activation has started. Cards come newest first, the
 *  order the rest of the app reads them in, so the first is the card it shows. */
const activationFacts = (
  account: ActivationAccount | undefined,
): CardActivationFacts | undefined => {
  const activation = account?.cardActivation
  if (!account || !activation) return undefined

  return {
    step: activation.step,
    isSetupComplete: Boolean(activation.setupCompletedAt),
    isPinSet: Boolean(account.cards[0]?.pinSetAt),
    hasPhysicalCard: account.cards.some(({ cardType }) => cardType === CardType.Physical),
    isWalletAdded: account.cards.some(({ walletAddedAt }) => Boolean(walletAddedAt)),
  }
}

/** The screen of where the member belongs, or none while the activation is unknown. */
const screenOfPlace = (facts: CardActivationFacts | undefined) => {
  if (!facts) return undefined
  return activationScreen(activationPlace(facts), facts)
}

type UseCardActivationOptions = {
  /** The step the calling screen stands for. While it is in front during the flow, the
   *  member's step follows it, so leaving or going back keeps the step on screen, and a
   *  step already behind the member sends them on to where they belong. */
  step?: CardActivationStep
  skip?: boolean
}

export const useCardActivation = ({
  step,
  skip = false,
}: UseCardActivationOptions = {}) => {
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { run } = useInFlightGuard()

  const { data, loading } = useCardActivationQuery({
    skip: !isAuthed || skip,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  })

  const account = data?.me?.defaultAccount
  const facts = useMemo(() => activationFacts(account), [account])
  const place = facts ? activationPlace(facts) : undefined
  const placeScreen = screenOfPlace(facts)
  const isComplete = facts?.isSetupComplete ?? false
  /** A read that failed leaves the activation unknown, which keeps every card screen as
   *  it was before the flow existed. */
  const isActivationKnown = facts !== undefined
  const isPending = isActivationKnown && !isComplete
  const isWaiting = loading && data === undefined

  const writeActivation = useCallback(
    (cache: ApolloCache<object>, activation: Activation) => {
      if (!account) return
      cache.modify({
        id: cache.identify({ __typename: account.__typename, id: account.id }),
        fields: { cardActivation: () => activation },
      })
    },
    [account],
  )

  const [updateStep] = useCardActivationStepUpdateMutation({
    update: (cache, { data: result }) => {
      if (result) writeActivation(cache, result.cardActivationStepUpdate)
    },
  })
  const [completeActivation, { loading: isCompleting }] =
    useCardActivationCompleteMutation({
      update: (cache, { data: result }) => {
        if (result) writeActivation(cache, result.cardActivationComplete)
      },
    })

  const show = useCallback(
    (route: FlowRoute, routePlace: ActivationPlace, routeFacts: CardActivationFacts) => {
      navigation.dispatch((state) => {
        const routes = routesTo<FlowRoute>(state.routes, {
          route,
          place: routePlace,
          facts: routeFacts,
        })
        return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
      })
    },
    [navigation],
  )

  const showPlace = useCallback(
    (routePlace: ActivationPlace, routeFacts: CardActivationFacts) => {
      show({ name: activationScreen(routePlace, routeFacts) }, routePlace, routeFacts)
    },
    [show],
  )

  const hasRedirectedRef = useRef(false)

  /**
   * Sends the member from the screen that asks to where they belong, replacing only that
   * screen: a PIN or an order half entered further down keeps the member on it when a
   * reset would drop it, and the reset would be refused. Once, since facts read again
   * before the screen is gone must not send them twice. With the activation unknown,
   * the way on is the dashboard, as before the flow existed.
   */
  const redirect = useCallback(() => {
    if (hasRedirectedRef.current) return
    hasRedirectedRef.current = true
    navigation.replace(placeScreen ?? "cardDashboardScreen")
  }, [placeScreen, navigation])

  /** Home's Card line lives in a tab navigator, which cannot reset the root stack, so the
   *  step's screen is pushed over the Home. */
  const resume = useCallback(() => {
    navigation.navigate(placeScreen ?? "cardDashboardScreen")
  }, [placeScreen, navigation])

  /** Moves on from `from`, whether the member took the step or skipped it. What they
   *  just did counts at once, before the cards are read again. */
  const moveOn = useCallback(
    (from: CardActivationStep, learned: LearnedFacts = {}) => {
      if (!facts) {
        navigation.replace("cardDashboardScreen")
        return
      }
      const nextFacts = { ...facts, ...learned, step: stepAfter(from) }
      showPlace(activationPlace(nextFacts), nextFacts)
    },
    [facts, navigation, showPlace],
  )

  /** The confirmation of a physical card ordered during the flow, shown on the way to
   *  the PIN the new card still needs. */
  const showOrderPlaced = useCallback(
    (params: OrderPlacedParams) => {
      if (!facts) {
        navigation.replace("cardStatusScreen", params)
        return
      }
      const nextFacts = { ...facts, hasPhysicalCard: true, isPinSet: false }
      show({ name: "cardStatusScreen", params }, CardActivationStep.Pin, nextFacts)
    },
    [facts, navigation, show],
  )

  /** One completion at a time: a second tap before the first answers would land the
   *  member on the dashboard twice. */
  const complete = useCallback(
    () =>
      run(async () => {
        try {
          await completeActivation()
        } catch (err) {
          const message = err instanceof Error ? err.message : LL.errors.unexpectedError()
          toastShow({ message, LL })
          return
        }
        if (!facts) {
          navigation.replace("cardDashboardScreen")
          return
        }
        showPlace(ACTIVATION_DONE, facts)
      }),
    [run, completeActivation, facts, navigation, showPlace, LL],
  )

  const hasStepOnScreen = step !== undefined
  const isStepOnScreenDone =
    hasStepOnScreen && isActivationKnown && isStepDone(step, facts)
  const isStepOnScreenBehind = isPending && isStepOnScreenDone
  const isMemberOnAnotherStep = facts?.step !== step
  const shouldFollowScreen =
    hasStepOnScreen && isPending && !isStepOnScreenDone && isMemberOnAnotherStep
  const followingStepRef = useRef<CardActivationStep | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (isStepOnScreenBehind) {
        redirect()
        return
      }
      if (!step || !shouldFollowScreen) return
      if (followingStepRef.current === step) return

      followingStepRef.current = step
      updateStep({ variables: { input: { step } } })
        .catch((err) => recordAppError(toError(err)))
        .finally(() => {
          followingStepRef.current = null
        })
    }, [isStepOnScreenBehind, shouldFollowScreen, step, redirect, updateStep]),
  )

  return {
    place,
    isPending,
    isComplete,
    isWaiting,
    isCompleting,
    resume,
    redirect,
    moveOn,
    showOrderPlaced,
    complete,
  }
}
