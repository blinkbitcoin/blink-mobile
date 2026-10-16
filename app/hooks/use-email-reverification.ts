import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import jsSha256 from "js-sha256"

import {
  useUserEmailDeleteMutation,
  useUserEmailRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveAccountKey } from "@app/store/persistent-state/account-key"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

gql`
  mutation userEmailDelete {
    userEmailDelete {
      errors {
        message
      }
      me {
        id
        phone
        totpEnabled
        email {
          address
          verified
        }
      }
    }
  }

  mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {
    userEmailRegistrationInitiate(input: $input) {
      errors {
        message
      }
      emailRegistrationId
      me {
        id
        email {
          address
          verified
        }
      }
    }
  }
`

type Sequence = {
  /** Tells it from the session's other sequences without keeping it alive: once a
   *  sequence is done, only the screens still waiting on it hold it. */
  id: number
  /** The session that started it: a sequence is the account's, never the device's. */
  sessionKey: string
  email: string
  /** What the screens waiting on the sequence see: the registration to validate, or
   *  null when the sequence went nowhere, which includes running past its deadline. */
  result: Promise<string | null>
}

/** How long the screens waiting on a sequence wait for it. A request that never
 *  answers, which the platform allows, would otherwise keep them waiting for the life
 *  of the process; at the deadline the sequence is over for them, and whatever its
 *  requests still answer is dropped. The requests themselves keep their place until
 *  they settle, and a late delete is still followed by its register: a new sequence
 *  over a delete still on its way, or a delete left without its register, could end
 *  with no address at all. */
const SEQUENCE_DEADLINE_MS = 60_000

/**
 * The sequence in flight, if any. It deletes the account's address before it registers
 * it again, so a second one interleaved with it could leave the account with no address
 * at all: one runs at a time, and whoever asks meanwhile joins it. Kept outside the
 * hook, since a sequence outlives any one screen: a screen that holds the user while
 * one runs releases the hold after a while, and the hook on a reopened screen must find
 * the sequence its predecessor started rather than start another.
 */
let sequenceInFlight: Sequence | null = null

/** How many sequences have started, which also numbers the next one. */
let sequenceCount = 0

/**
 * The sequence each session is owed a code screen for, by id: the latest one started,
 * until the code screen is shown for it, which happens once however many screens
 * waited on it. A newer sequence of the session takes the place of an older one still
 * unshown, since it registers the address again and a code screen for the older
 * registration would validate one that no longer exists; another session's sequence
 * touches its own address only, so it takes nobody's place. One that went nowhere
 * has no code screen to show and stays the session's until the next one, at the cost
 * of an id: nothing else of a sequence is kept here, so no address outlives the
 * screens that waited on it.
 */
const owedCodeScreenBySession = new Map<string, number>()

const isCodeScreenOwedFor = (sequence: Sequence) =>
  owedCodeScreenBySession.get(sequence.sessionKey) === sequence.id

type SequenceRequest = Pick<Sequence, "sessionKey" | "email">

const startSequence = (
  request: SequenceRequest,
  run: (request: SequenceRequest) => Promise<string | null>,
): Sequence => {
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  const settledAtDeadline = new Promise<null>((resolve) => {
    deadlineTimer = setTimeout(() => resolve(null), SEQUENCE_DEADLINE_MS)
  })
  const requests = run(request).finally(() => {
    clearTimeout(deadlineTimer)
    if (sequenceInFlight === sequence) sequenceInFlight = null
  })
  sequenceCount += 1
  const sequence: Sequence = {
    ...request,
    id: sequenceCount,
    result: Promise.race([requests, settledAtDeadline]),
  }
  sequenceInFlight = sequence
  owedCodeScreenBySession.set(request.sessionKey, sequence.id)
  return sequence
}

/** What a prompt was raised over, to tell at its answer whether it is outdated. */
type PromptContext = {
  sessionKey: string
  /** The sequence count then: one started since is the one the user is on now. */
  sequenceCount: number
  /** The sequence the session was owed a code screen for then: one shown since is in
   *  front now. */
  owedSequenceId: number | undefined
}

type EmailReverificationOptions = {
  /** Where the code screen goes on success instead of its own destination, for a
   *  screen the flow has to return into. */
  returnTo?: RegistrationReturnRoute
}

/**
 * Re-verification for an address the account already holds. The registration
 * flow can't be re-run as-is — the backend refuses to initiate while any email
 * sits on the identity — so the stale one is deleted and set again in one go.
 * Shared by the account settings row, the security score card and the two-factor
 * setup, which all land on this state and must behave the same way. The code
 * screen is shown once per sequence, by the screen that is in front when the
 * sequence is done, with that screen's own return route: a screen that is covered at
 * that moment, by the lock on a resume or by a route pushed over it, shows it as
 * soon as it is in front again, and a screen the user has left shows nothing.
 */
export const useEmailReverification = ({ returnTo }: EmailReverificationOptions = {}) => {
  const { LL } = useI18nContext()
  const { persistentState } = usePersistentStateContext()
  const { galoyAuthToken } = persistentState
  /** The profile the token is used for. Resolved the way the client does, so a
   *  custodial profile id first saved under the screen is not taken for a switch. */
  const accountKey = resolveAccountKey(persistentState)
  /** The token digest plus the profile, so that profiles sharing a stored token stay
   *  distinct: a self-custodial profile keeps the custodial token stored while it is
   *  active. A digest, so no sequence keeps the token itself alive past a logout. */
  const sessionKey = useMemo(
    () => `${jsSha256.sha256(galoyAuthToken)}:${accountKey}`,
    [galoyAuthToken, accountKey],
  )
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isMounted = useIsMounted()

  const [emailDeleteMutation] = useUserEmailDeleteMutation()
  const [setEmailMutation] = useUserEmailRegistrationInitiateMutation()

  /** What callers render: spans the sequence from before its first request to after
   *  its last, rather than following each mutation's own loading flag. Whether the
   *  sequence was asked for from this screen is told apart, for a screen that holds
   *  the user for its own request and must not for one joined from elsewhere. */
  const [isSequenceRunning, setIsSequenceRunning] = useState(false)
  const [isAskedHere, setIsAskedHere] = useState(false)
  /** The sequence this screen already waits on: a prompt's buttons close over the
   *  render that raised them, and two prompts answered before either is done must wait
   *  once, not twice. A ref, since a state would be unset in both closures. */
  const awaitedSequenceRef = useRef<Sequence | null>(null)
  const unsubscribeDeliveryRef = useRef<(() => void) | null>(null)
  /** The session as of now, for a wait or a prompt that began under the previous one:
   *  a switch can happen under a screen without unmounting it. */
  const sessionKeyRef = useRef(sessionKey)
  sessionKeyRef.current = sessionKey
  const returnToRef = useRef(returnTo)
  returnToRef.current = returnTo

  /** Deletes the address and registers it again, both under the session that asked:
   *  the requests go through the client of the moment, so a session switched between
   *  the two would register the address on the other account. The sequence stops
   *  there instead, and the account asked under is left without its address, with no
   *  word of it: whatever is in front by then is the other account's. A switch within
   *  the seconds between the two requests is rare, and registering the address through
   *  the other account's session would be worse. Past the deadline the register still
   *  runs, since a delete left without it strips the account of the address, and a
   *  refusal is still shown: it is the one word the user gets that the address is gone.
   *  Never throws: a sequence that went nowhere hands back null, and every screen
   *  waiting on it stays put. */
  const runSequence = useCallback(
    async ({
      sessionKey: askedUnder,
      email,
    }: SequenceRequest): Promise<string | null> => {
      const isSessionSwitched = () => sessionKeyRef.current !== askedUnder
      try {
        await emailDeleteMutation({
          // to avoid flacky behavior
          // this could lead to inconsistent state if delete works but set fails
          fetchPolicy: "no-cache",
        })

        if (isSessionSwitched()) {
          console.warn("session switched during email re-verification")
          return null
        }

        const { data } = await setEmailMutation({
          variables: { input: { email } },
        })

        const errors = data?.userEmailRegistrationInitiate.errors
        const hasErrors = errors !== undefined && errors.length > 0
        if (hasErrors && !isSessionSwitched()) {
          Alert.alert(errors[0].message)
        }

        const emailRegistrationId =
          data?.userEmailRegistrationInitiate.emailRegistrationId
        if (!emailRegistrationId) {
          console.warn("no flow returned")
          return null
        }
        return emailRegistrationId
      } catch (err) {
        console.error(err, "error in setEmailMutation")
        return null
      }
    },
    [emailDeleteMutation, setEmailMutation],
  )

  /** Moves this screen on to the code screen, once per sequence, when it is in front:
   *  at once if it is, or on a later focus if it is covered. A screen the user has
   *  left has nothing to show it on. A sequence a newer one has taken the place of is
   *  not shown, nor is one of a session that has been switched away from; a covered
   *  screen keeps waiting through a focus under another session, since the switch can
   *  be undone before the screen is back under its own. One pending focus at a time:
   *  a newer one replaces an older one still pending. */
  const moveOnWhenInFront = useCallback(
    (sequence: Sequence, emailRegistrationId: string) => {
      const isUnderOwnSession = () => sequence.sessionKey === sessionKeyRef.current
      const moveOn = () => {
        const isOwed = isCodeScreenOwedFor(sequence) && isUnderOwnSession()
        if (!isOwed) return
        owedCodeScreenBySession.delete(sequence.sessionKey)
        navigation.navigate("emailRegistrationValidate", {
          emailRegistrationId,
          email: sequence.email,
          returnTo: returnToRef.current,
        })
      }
      if (!isMounted()) return
      if (navigation.isFocused()) {
        moveOn()
        return
      }
      unsubscribeDeliveryRef.current?.()
      const unsubscribe = navigation.addListener("focus", () => {
        if (!isUnderOwnSession()) return
        unsubscribe()
        if (unsubscribeDeliveryRef.current === unsubscribe) {
          unsubscribeDeliveryRef.current = null
        }
        moveOn()
      })
      unsubscribeDeliveryRef.current = unsubscribe
    },
    [navigation, isMounted],
  )

  /** The running state follows the sequence this screen waits on now: a sequence it
   *  waited on earlier, answering late, must not clear it for a newer one. A press on
   *  this screen for a sequence it had joined from elsewhere makes it this screen's. */
  const waitOnSequence = useCallback(
    async (sequence: Sequence, isAskedFromHere: boolean) => {
      const isAlreadyAwaited = awaitedSequenceRef.current === sequence
      if (isAlreadyAwaited) {
        if (isAskedFromHere) setIsAskedHere(true)
        return
      }
      awaitedSequenceRef.current = sequence
      setIsSequenceRunning(true)
      setIsAskedHere(isAskedFromHere)
      try {
        const emailRegistrationId = await sequence.result
        if (emailRegistrationId !== null) moveOnWhenInFront(sequence, emailRegistrationId)
      } finally {
        const isStillAwaited = awaitedSequenceRef.current === sequence
        if (isStillAwaited) {
          // eslint-disable-next-line require-atomic-updates -- single writer per sequence; the check above keeps a newer wait's own entry
          awaitedSequenceRef.current = null
          if (isMounted()) {
            setIsSequenceRunning(false)
            setIsAskedHere(false)
          }
        }
      }
    },
    [moveOnWhenInFront, isMounted],
  )

  /** A screen that goes away takes its pending focus with it. Only on going away: a
   *  session switched under the screen and back must not cost it a code screen owed. */
  useEffect(
    () => () => {
      unsubscribeDeliveryRef.current?.()
      unsubscribeDeliveryRef.current = null
    },
    [],
  )

  /** A screen joins the sequence in flight when it mounts and whenever it comes to the
   *  front, so it is held by it and gets the code screen like the screen that started
   *  it: a screen beneath the starter is already mounted when the sequence starts, and
   *  only meets it on the way back. One another session started, and that its request
   *  still keeps alive after a switch or a fresh login, is not this account's to join. */
  useEffect(() => {
    const joinSequenceInFlight = () => {
      const running = sequenceInFlight
      if (running === null) return
      const isOurs = running.sessionKey === sessionKey
      if (isOurs) waitOnSequence(running, false)
    }
    joinSequenceInFlight()
    return navigation.addListener("focus", joinSequenceInFlight)
  }, [navigation, sessionKey, waitOnSequence])

  /** Joins the sequence in flight or starts one, unless the sequence in flight is
   *  another session's: its register may still land on this account, so nothing runs
   *  alongside it. A prompt answered after a session switch asked about the other
   *  account's address, and one answered after the app removed the screen has nothing
   *  to show the code screen on: both start nothing, and the address stays as it is.
   *  Nor does one answered after a sequence started or was shown since the prompt was
   *  raised, as a second tap's can be: the user is on that sequence now, and another
   *  would delete the address under the code screen they are typing into. */
  const confirmEmailAgain = useCallback(
    (email: string, prompt: PromptContext) => {
      const askedUnder = sessionKeyRef.current
      const isPromptOutdated = prompt.sessionKey !== askedUnder || !isMounted()
      if (isPromptOutdated) return
      const running = sequenceInFlight
      const isSequenceOfAnotherSession =
        running !== null && running.sessionKey !== askedUnder
      if (isSequenceOfAnotherSession) return
      if (running !== null) return waitOnSequence(running, true)
      const isPromptOvertaken =
        sequenceCount !== prompt.sequenceCount ||
        owedCodeScreenBySession.get(askedUnder) !== prompt.owedSequenceId
      if (isPromptOvertaken) return
      const request = { sessionKey: askedUnder, email }
      return waitOnSequence(startSequence(request, runSequence), true)
    },
    [isMounted, waitOnSequence, runSequence],
  )

  const promptReverification = useCallback(
    (email: string) => {
      const sessionKeyNow = sessionKeyRef.current
      const prompt: PromptContext = {
        sessionKey: sessionKeyNow,
        sequenceCount,
        owedSequenceId: owedCodeScreenBySession.get(sessionKeyNow),
      }
      Alert.alert(
        LL.AccountScreen.emailUnverified(),
        LL.AccountScreen.emailUnverifiedContent(),
        [
          { text: LL.common.cancel(), onPress: () => {} },
          {
            text: LL.common.ok(),
            onPress: () => confirmEmailAgain(email, prompt),
          },
        ],
      )
    },
    [LL, confirmEmailAgain],
  )

  return { promptReverification, spinner: isSequenceRunning, isAskedHere }
}
