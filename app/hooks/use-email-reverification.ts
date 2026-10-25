import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"

import {
  useUserEmailDeleteMutation,
  useUserEmailRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveSessionKey } from "@app/store/persistent-state/account-key"
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
        code
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

/** How long the screens waiting on a sequence wait for it, since a request can hang
 *  for the life of the process: at the deadline the sequence is over for them and a
 *  later answer is dropped. The requests keep their place until they settle, and a
 *  late delete is still followed by its register, as a second delete over one still on
 *  its way, or a delete left alone, could end with no address at all. */
const SEQUENCE_DEADLINE_MS = 60_000

/** The sequence in flight, if any: one runs at a time, and whoever asks meanwhile joins
 *  it, since two interleaved could leave the account with no address. Module state, as
 *  a sequence outlives any one screen: a reopened screen must find the one its
 *  predecessor started rather than start another. */
let sequenceInFlight: Sequence | null = null

/** How many sequences have started, which also numbers the next one. */
let sequenceCount = 0

/** The sequence each session is owed a code screen for, by id: the latest started,
 *  until shown, which happens once however many screens waited on it. A newer one of
 *  the session takes an older one's place, since it registers the address again; one
 *  that went nowhere just stays until the next. Only ids live here, so no address
 *  outlives the screens that waited on it. */
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

/**
 * Re-verification for an address the account already holds. The registration
 * flow can't be re-run as-is — the backend refuses to initiate while any email
 * sits on the identity — so the stale one is deleted and set again in one go.
 * Shared by the account settings row and the security score card, which both land on
 * this state and must behave the same way. The code screen is shown once per
 * sequence, by the screen in front when it is done; a screen covered at that moment
 * shows it once it is back in front, and one the user has left shows nothing.
 */
export const useEmailReverification = () => {
  const { LL } = useI18nContext()
  const { persistentState } = usePersistentStateContext()
  const { galoyAuthToken, activeAccountId } = persistentState
  const sessionKey = useMemo(
    () => resolveSessionKey({ galoyAuthToken, activeAccountId }),
    [galoyAuthToken, activeAccountId],
  )
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isMounted = useIsMounted()

  const [emailDeleteMutation] = useUserEmailDeleteMutation()
  const [setEmailMutation] = useUserEmailRegistrationInitiateMutation()

  /** What callers render: spans the sequence from before its first request to after
   *  its last, rather than following each mutation's own loading flag. */
  const [isSequenceRunning, setIsSequenceRunning] = useState(false)
  /** The sequence this screen already waits on: a prompt's buttons close over the
   *  render that raised them, and two prompts answered before either is done must wait
   *  once, not twice. A ref, since a state would be unset in both closures. */
  const awaitedSequenceRef = useRef<Sequence | null>(null)
  const unsubscribeDeliveryRef = useRef<(() => void) | null>(null)
  /** The session as of now, for a wait or a prompt that began under the previous one:
   *  a switch can happen under a screen without unmounting it. */
  const sessionKeyRef = useRef(sessionKey)
  sessionKeyRef.current = sessionKey

  /** Deletes the address and registers it again under the session that asked. The
   *  requests go through the client of the moment, so on a session switch between the
   *  two the sequence stops rather than register the address on the other account; the
   *  account asked under is then left without its address, and nothing says so, since
   *  whatever is in front is the other account's. An accepted loss: the switch has to
   *  land within the seconds between the two requests. Past the deadline the register
   *  still runs, and a refusal is still shown, as the one word that the address is
   *  gone. Never throws: a sequence that went nowhere hands back null. */
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

  /** Moves this screen on to the code screen, once per sequence: at once when it is
   *  in front, on a later focus when it is covered, never once the user has left it. A
   *  sequence a newer one replaced, or of a session switched away from, is not shown;
   *  a covered screen keeps waiting through a focus under another session, as the
   *  switch can be undone. One pending focus at a time, the newest. */
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
   *  waited on earlier, answering late, must not clear it for a newer one. */
  const waitOnSequence = useCallback(
    async (sequence: Sequence) => {
      const isAlreadyAwaited = awaitedSequenceRef.current === sequence
      if (isAlreadyAwaited) return
      awaitedSequenceRef.current = sequence
      setIsSequenceRunning(true)
      try {
        const emailRegistrationId = await sequence.result
        if (emailRegistrationId !== null) moveOnWhenInFront(sequence, emailRegistrationId)
      } finally {
        const isStillAwaited = awaitedSequenceRef.current === sequence
        if (isStillAwaited) {
          // eslint-disable-next-line require-atomic-updates -- single writer per sequence; the check above keeps a newer wait's own entry
          awaitedSequenceRef.current = null
          if (isMounted()) setIsSequenceRunning(false)
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
      if (isOurs) waitOnSequence(running)
    }
    joinSequenceInFlight()
    return navigation.addListener("focus", joinSequenceInFlight)
  }, [navigation, sessionKey, waitOnSequence])

  /** Joins the sequence in flight or starts one. Nothing runs alongside another
   *  session's sequence, whose register may still land on this account. A prompt
   *  answered after a session switch, after the app removed its screen, or after a
   *  sequence started or was shown since it was raised, as a second tap's is, starts
   *  nothing: another sequence would delete the address under the code screen. */
  const confirmEmailAgain = useCallback(
    (email: string, prompt: PromptContext) => {
      const askedUnder = sessionKeyRef.current
      const isPromptOutdated = prompt.sessionKey !== askedUnder || !isMounted()
      if (isPromptOutdated) return
      const running = sequenceInFlight
      const isSequenceOfAnotherSession =
        running !== null && running.sessionKey !== askedUnder
      if (isSequenceOfAnotherSession) return
      if (running !== null) return waitOnSequence(running)
      const isPromptOvertaken =
        sequenceCount !== prompt.sequenceCount ||
        owedCodeScreenBySession.get(askedUnder) !== prompt.owedSequenceId
      if (isPromptOvertaken) return
      const request = { sessionKey: askedUnder, email }
      return waitOnSequence(startSequence(request, runSequence))
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

  return { promptReverification, spinner: isSequenceRunning }
}
