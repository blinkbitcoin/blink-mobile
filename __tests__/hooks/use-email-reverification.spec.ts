import { Alert, AlertButton } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import { useEmailReverification } from "@app/hooks/use-email-reverification"

import { flushEffects } from "../helpers/flush-effects"

const EMAIL = "someone@example.com"

const mockNavigate = jest.fn()
/** Whether the screen the hook runs on is the one in front, answered per call. */
const mockIsFocused = jest.fn(() => true)
type FocusListener = () => void
const mockAddListener = jest.fn((_event: string, _listener: FocusListener) => jest.fn())
/** One object for every render, as the navigator hands a screen one object. */
const mockNavigation = {
  navigate: mockNavigate,
  isFocused: () => mockIsFocused(),
  addListener: mockAddListener,
}
let mockToken = "session-of-account-a"
let mockAccountId: string | undefined = "custodial-default"
const mockEmailDelete = jest.fn()
const mockRegistrationInitiate = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useUserEmailDeleteMutation: () => [mockEmailDelete, { loading: false }],
  useUserEmailRegistrationInitiateMutation: () => [
    mockRegistrationInitiate,
    { loading: false },
  ],
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { galoyAuthToken: mockToken, activeAccountId: mockAccountId },
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountScreen: {
        emailUnverified: () => "Email not verified",
        emailUnverifiedContent: () => "Send the code again?",
      },
      common: {
        cancel: () => "Cancel",
        ok: () => "OK",
      },
    },
  }),
}))

/** A button of the prompt raised by the given call, the first one unless told otherwise. */
const alertButton = (label: string, prompt = 0) => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[prompt]
  return (buttons as AlertButton[]).find(({ text }) => text === label)
}

/** Inside `act`, as the sequence the button starts renders the hook's running state. */
const pressAlertButton = async (label: string, prompt = 0) => {
  await act(async () => {
    await alertButton(label, prompt)?.onPress?.()
  })
}

/** Answers the prompt and leaves the sequence it started running. */
const pressOkAndLeaveRunning = async (prompt = 0) => {
  await act(async () => {
    alertButton("OK", prompt)?.onPress?.()
  })
}

/** The focus listeners installed so far: one per screen to join a sequence on focus,
 *  plus one for a covered screen to move on later. */
const focusListeners = () =>
  mockAddListener.mock.calls
    .filter(([event]) => event === "focus")
    .map(([, listener]) => listener)

/** What removes the last focus listener installed, whatever else was listened to since. */
const lastFocusUnsubscribe = () => {
  const { calls, results } = mockAddListener.mock
  const focusResults = results.filter((_result, index) => calls[index][0] === "focus")
  return focusResults.at(-1)?.value
}

const registrationResult = (
  data: Record<string, unknown>,
): { data: Record<string, unknown> } => ({
  data: { userEmailRegistrationInitiate: data },
})

/** The requests held back by a test, released after it so the sequence in flight,
 *  which outlives the hook, never leaks into the next test. */
let heldAnswers: Array<() => void> = []

/** A delete that answers only when the test says so. */
const deletionHeld = () => {
  let finish = () => {}
  mockEmailDelete.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  heldAnswers.push(finish)
  return () => finish()
}

/** A registration that answers, with a registration to validate, only when the test
 *  says so. */
const registrationHeld = () => {
  let finish = () => {}
  mockRegistrationInitiate.mockReturnValue(
    new Promise((resolve) => {
      finish = () =>
        resolve(
          registrationResult({ errors: [], emailRegistrationId: "registration-id" }),
        )
    }),
  )
  heldAnswers.push(finish)
  return () => finish()
}

// eslint-disable-next-line max-lines-per-function -- one hook's suite, sharing the mock reset and the held answers above; splitting solely to meet the line cap would scatter cases that are read together
describe("useEmailReverification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused.mockReturnValue(true)
    mockToken = "session-of-account-a"
    mockAccountId = "custodial-default"
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    // The give-up branches log on purpose; the assertions cover them.
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    mockEmailDelete.mockResolvedValue({ data: {} })
    mockRegistrationInitiate.mockResolvedValue(
      registrationResult({ errors: [], emailRegistrationId: "registration-id" }),
    )
  })

  afterEach(async () => {
    heldAnswers.forEach((finish) => finish())
    heldAnswers = []
    await flushEffects()
    jest.useRealTimers()
  })

  it("asks before touching the address already on the account", () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)

    expect(Alert.alert).toHaveBeenCalledWith(
      "Email not verified",
      "Send the code again?",
      expect.any(Array),
    )
    expect(mockEmailDelete).not.toHaveBeenCalled()
  })

  /** Registration is refused while any address sits on the identity, so the
   *  stale one has to go first — and it must not be cached away. */
  it("deletes the stale address, registers it again and moves to the code screen", async () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")

    expect(mockEmailDelete).toHaveBeenCalledWith({ fetchPolicy: "no-cache" })
    expect(mockRegistrationInitiate).toHaveBeenCalledWith({
      variables: { input: { email: EMAIL } },
    })
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: EMAIL,
      emailRegistrationId: "registration-id",
      returnTo: undefined,
    })
  })

  /** Callers hold their screen on the spinner, so it must not drop between the two
   *  requests, whatever each mutation reports about itself in between. */
  it("reports the sequence as running from the first request until the last has answered", async () => {
    const finishDeletion = deletionHeld()
    const finishRegistration = registrationHeld()
    const { result } = renderHook(() => useEmailReverification())
    expect(result.current.spinner).toBe(false)

    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    expect(result.current.spinner).toBe(true)

    finishDeletion()
    await flushEffects()
    expect(result.current.spinner).toBe(true)

    finishRegistration()
    await flushEffects()
    expect(result.current.spinner).toBe(false)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it("hands the code screen the screen's own route to return to", async () => {
    const { result } = renderHook(() =>
      useEmailReverification({ returnTo: "twoFactorSetup" }),
    )

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: EMAIL,
      emailRegistrationId: "registration-id",
      returnTo: "twoFactorSetup",
    })
  })

  /** Two taps before the native alert takes over raise two prompts from the same
   *  render; answering both must not run the delete a second time mid-registration. */
  it("runs one sequence when two prompts are answered before the first is done", async () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    result.current.promptReverification(EMAIL)
    await act(async () => {
      const firstRun = alertButton("OK", 0)?.onPress?.()
      await alertButton("OK", 1)?.onPress?.()
      await firstRun
    })

    expect(mockEmailDelete).toHaveBeenCalledTimes(1)
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** A screen that holds the user while the sequence runs releases the hold after a
   *  while; the screen reopened then joins the sequence on mount, is held by it, and is
   *  the one to move on, with its own return route, since the screen that started the
   *  sequence was left. */
  it("joins a sequence in flight on mount, and moves on in place of the screen that was left", async () => {
    const finishDeletion = deletionHeld()
    const left = renderHook(() => useEmailReverification())
    left.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    left.unmount()

    const reopened = renderHook(() =>
      useEmailReverification({ returnTo: "twoFactorSetup" }),
    )
    await flushEffects()

    expect(reopened.result.current.spinner).toBe(true)
    expect(mockEmailDelete).toHaveBeenCalledTimes(1)

    finishDeletion()
    await flushEffects()

    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: EMAIL,
      emailRegistrationId: "registration-id",
      returnTo: "twoFactorSetup",
    })
    expect(reopened.result.current.spinner).toBe(false)
  })

  /** A screen beneath the starter was mounted before the sequence began, so it meets
   *  the sequence only when it comes to the front again. */
  it("joins a sequence in flight when its screen comes to the front, not only on mount", async () => {
    const finishDeletion = deletionHeld()
    const beneath = renderHook(() => useEmailReverification())
    const [joinOnFocus] = focusListeners()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    starter.unmount()
    expect(beneath.result.current.spinner).toBe(false)

    await act(async () => joinOnFocus())

    expect(beneath.result.current.spinner).toBe(true)

    finishDeletion()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(beneath.result.current.spinner).toBe(false)
  })

  it("moves on once per sequence, however many screens waited on it", async () => {
    const finishDeletion = deletionHeld()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const joiner = renderHook(() => useEmailReverification())
    await flushEffects()
    expect(joiner.result.current.spinner).toBe(true)

    finishDeletion()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(starter.result.current.spinner).toBe(false)
    expect(joiner.result.current.spinner).toBe(false)
  })

  /** A sequence is the account's: one a previous session started, and whose request
   *  still runs after a switch or a fresh login, is nobody's to join or to be moved
   *  on by, and nothing runs alongside it, since its register may still land here. */
  it("neither joins nor runs alongside a sequence another session started, and moves on by it for nobody", async () => {
    const finishDeletion = deletionHeld()
    const previous = renderHook(() => useEmailReverification())
    previous.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    previous.unmount()

    mockToken = "session-of-account-b"
    const next = renderHook(() => useEmailReverification())
    await flushEffects()
    expect(next.result.current.spinner).toBe(false)

    next.result.current.promptReverification("other@example.com")
    await pressAlertButton("OK", 1)
    expect(mockEmailDelete).toHaveBeenCalledTimes(1)
    expect(next.result.current.spinner).toBe(false)

    finishDeletion()
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A self-custodial profile keeps the custodial token stored while it is active, so
   *  the profile is part of the session, not the token alone. */
  it("treats a sequence of a profile switched away from under the same token as absent", async () => {
    const finishDeletion = deletionHeld()
    const custodial = renderHook(() => useEmailReverification())
    custodial.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    custodial.unmount()

    mockAccountId = "self-custodial-1"
    const selfCustodial = renderHook(() => useEmailReverification())
    await flushEffects()
    expect(selfCustodial.result.current.spinner).toBe(false)

    finishDeletion()
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A request that never answers must not keep any screen waiting for the life of the
   *  process: at the deadline the sequence is over for every screen, and what its
   *  requests still answer goes nowhere, not even to the backend. The requests keep
   *  their place until they settle, since a new delete over one still on its way could
   *  end with no address at all. */
  it("ends a sequence for every screen at its deadline, holds its place until its requests settle, and drops what they still answer", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    const finishStalledDeletion = deletionHeld()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const waiter = renderHook(() => useEmailReverification())
    await flushEffects()
    expect(waiter.result.current.spinner).toBe(true)

    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    await flushEffects()

    expect(starter.result.current.spinner).toBe(false)
    expect(waiter.result.current.spinner).toBe(false)
    /** What releases a screen that holds the user for its own request. */
    expect(starter.result.current.isAskedHere).toBe(false)
    expect(mockNavigate).not.toHaveBeenCalled()

    /** The stalled delete is still on its way: nothing starts over it. */
    waiter.result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 1)
    expect(mockEmailDelete).toHaveBeenCalledTimes(1)

    /** Its register still follows, so the account is not left without the address;
     *  nobody is moved on by it. */
    finishStalledDeletion()
    await flushEffects()
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()

    /** Settled, the stalled sequence makes way for a fresh one. */
    mockEmailDelete.mockResolvedValue({ data: {} })
    waiter.result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 2)

    expect(mockEmailDelete).toHaveBeenCalledTimes(2)
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(2)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** A registration that answers with an error only the sequence's own screens should
   *  hear about. */
  const registrationRefusedHeld = () => {
    let finish = () => {}
    mockRegistrationInitiate.mockReturnValue(
      new Promise((resolve) => {
        finish = () =>
          resolve(
            registrationResult({
              errors: [{ message: "Email already taken" }],
              emailRegistrationId: null,
            }),
          )
      }),
    )
    heldAnswers.push(finish)
    return () => finish()
  }

  /** The address is gone by then: the refusal is the one word the user gets of it. */
  it("still shows the error of a register refused past the deadline", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    const finishRefusedRegistration = registrationRefusedHeld()
    const { result } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    await flushEffects()
    expect(result.current.spinner).toBe(false)

    finishRefusedRegistration()
    await flushEffects()

    expect(jest.mocked(Alert.alert).mock.calls).toHaveLength(2)
    expect(Alert.alert).toHaveBeenLastCalledWith("Email already taken")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The client treats a custodial profile id that was never saved and the custodial
   *  default as the same session; saving it under the screen is not a switch. */
  it("keeps the sequence when the custodial profile id is first saved under the screen", async () => {
    mockAccountId = undefined
    const finishDeletion = deletionHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()

    mockAccountId = "custodial-default"
    rerender({})
    finishDeletion()
    await flushEffects()

    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it("shows no error of a registration answered under a session switched to meanwhile", async () => {
    const finishRefusedRegistration = registrationRefusedHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    await flushEffects()
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)

    mockToken = "session-of-account-b"
    rerender({})
    finishRefusedRegistration()
    await flushEffects()

    expect(jest.mocked(Alert.alert).mock.calls).toHaveLength(1)
  })

  /** Another account's sequence touches its own address only. */
  it("keeps a code screen owed under one session when another session starts a sequence", async () => {
    const finishDeletion = deletionHeld()
    const covered = renderHook(() => useEmailReverification())
    covered.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()
    const moveOnOnFocus = focusListeners().at(-1)
    mockIsFocused.mockReturnValue(true)

    mockToken = "session-of-account-b"
    mockEmailDelete.mockResolvedValue({ data: {} })
    const other = renderHook(() => useEmailReverification())
    other.result.current.promptReverification("other@example.com")
    await pressAlertButton("OK", 1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    mockToken = "session-of-account-a"
    covered.rerender({})
    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(2)
    expect(mockNavigate).toHaveBeenLastCalledWith(
      "emailRegistrationValidate",
      expect.objectContaining({ email: EMAIL }),
    )
  })

  it("lets a newer sequence of the session take the place of an older one owed, whatever another session ran in between", async () => {
    const finishDeletion = deletionHeld()
    const covered = renderHook(() => useEmailReverification())
    covered.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()
    const moveOnOnFocus = focusListeners().at(-1)
    mockIsFocused.mockReturnValue(true)

    mockToken = "session-of-account-b"
    mockEmailDelete.mockResolvedValue({ data: {} })
    const other = renderHook(() => useEmailReverification())
    other.result.current.promptReverification("other@example.com")
    await pressAlertButton("OK", 1)
    other.unmount()

    mockToken = "session-of-account-a"
    covered.rerender({})
    const newer = renderHook(() => useEmailReverification())
    newer.result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 2)
    expect(mockNavigate).toHaveBeenCalledTimes(2)

    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })

  it("makes a sequence joined from elsewhere this screen's own once it is asked for here too", async () => {
    const finishDeletion = deletionHeld()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const joiner = renderHook(() => useEmailReverification())
    await flushEffects()
    expect(joiner.result.current.isAskedHere).toBe(false)

    joiner.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning(1)

    expect(joiner.result.current.isAskedHere).toBe(true)
    expect(mockEmailDelete).toHaveBeenCalledTimes(1)

    finishDeletion()
    await flushEffects()

    expect(joiner.result.current.isAskedHere).toBe(false)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it("tells a sequence asked for from this screen from one joined from elsewhere", async () => {
    const finishDeletion = deletionHeld()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const joiner = renderHook(() => useEmailReverification())
    await flushEffects()

    expect(starter.result.current.isAskedHere).toBe(true)
    expect(joiner.result.current.isAskedHere).toBe(false)
    expect(joiner.result.current.spinner).toBe(true)

    finishDeletion()
    await flushEffects()

    expect(starter.result.current.isAskedHere).toBe(false)
  })

  it("keeps only the latest pending focus of a covered screen, and lets it go on unmount", async () => {
    const finishFirst = deletionHeld()
    const { result, unmount } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishFirst()
    await flushEffects()
    const removeFirst = lastFocusUnsubscribe()

    const finishSecond = deletionHeld()
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning(1)
    finishSecond()
    await flushEffects()
    const removeSecond = lastFocusUnsubscribe()
    expect(removeFirst).toHaveBeenCalledTimes(1)

    unmount()

    expect(removeSecond).toHaveBeenCalledTimes(1)
  })

  it("starts nothing from a prompt answered after the app removed its screen", async () => {
    const { result, unmount } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)

    unmount()
    await pressAlertButton("OK")

    expect(mockEmailDelete).not.toHaveBeenCalled()
  })

  /** The running state is the sequence's the screen waits on now: the end of one it
   *  waited on earlier must not clear it. */
  it("keeps the running state of a screen that moved on to a newer sequence when an older one ends", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    const finishOldDeletion = deletionHeld()
    const { result } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    await flushEffects()
    expect(result.current.spinner).toBe(false)
    finishOldDeletion()
    await flushEffects()

    const finishNewDeletion = deletionHeld()
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning(1)
    expect(result.current.spinner).toBe(true)

    await flushEffects()
    expect(result.current.spinner).toBe(true)

    finishNewDeletion()
    await flushEffects()
    expect(result.current.spinner).toBe(false)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** The session is judged when the focus comes: a switch can happen while the screen
   *  is covered, and be undone later. */
  it("keeps a covered screen waiting through a focus under another session, and moves on once back under its own", async () => {
    const finishDeletion = deletionHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()
    const moveOnOnFocus = focusListeners().at(-1)
    const removeMoveOn = lastFocusUnsubscribe()

    mockToken = "session-of-account-b"
    rerender({})
    act(() => moveOnOnFocus?.())
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(removeMoveOn).not.toHaveBeenCalled()

    mockToken = "session-of-account-a"
    rerender({})
    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(removeMoveOn).toHaveBeenCalledTimes(1)
  })

  /** In front, the screen has no later focus to wait for. */
  it("shows nothing on a screen in front when the register answers under a session switched to meanwhile", async () => {
    const finishRegistration = registrationHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    await flushEffects()

    mockToken = "session-of-account-b"
    rerender({})
    finishRegistration()
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.spinner).toBe(false)
  })

  /** The second tap's prompt is answered over the code screen the first one led to. */
  it("starts nothing from a prompt answered after a sequence started since it was raised", async () => {
    const { result } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 0)
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    await pressAlertButton("OK", 1)

    expect(mockEmailDelete).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(result.current.spinner).toBe(false)
  })

  it("starts nothing from a prompt raised over a sequence in flight that has been shown since", async () => {
    const finishDeletion = deletionHeld()
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const other = renderHook(() => useEmailReverification())
    other.result.current.promptReverification(EMAIL)
    finishDeletion()
    await flushEffects()
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    await pressAlertButton("OK", 1)

    expect(mockEmailDelete).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** The setup screen's hold rests on this through the lock on a resume. */
  it("keeps a sequence this screen asked for its own when the screen comes to the front again", async () => {
    const finishDeletion = deletionHeld()
    const { result } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const joinOnFocus = focusListeners()[0]

    act(() => joinOnFocus?.())

    expect(result.current.isAskedHere).toBe(true)
    expect(result.current.spinner).toBe(true)
    finishDeletion()
  })

  /** Judged when the screen is in front, not when the answer lands: a switch under a
   *  covered screen can be undone before the screen is back. */
  it("keeps a code screen that landed on a covered screen while the session was switched away, once it is back", async () => {
    const finishRegistration = registrationHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    await flushEffects()
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)

    mockIsFocused.mockReturnValue(false)
    mockToken = "session-of-account-b"
    rerender({})
    finishRegistration()
    await flushEffects()
    const moveOnOnFocus = focusListeners().at(-1)
    expect(mockNavigate).not.toHaveBeenCalled()

    mockToken = "session-of-account-a"
    rerender({})
    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenLastCalledWith(
      "emailRegistrationValidate",
      expect.objectContaining({ emailRegistrationId: "registration-id", email: EMAIL }),
    )
  })

  /** The requests go through the client of the moment, so a session switched between
   *  the two would register the address on the other account. */
  it("stops between the delete and the register when the session was switched meanwhile", async () => {
    const finishDeletion = deletionHeld()
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()

    mockToken = "session-of-account-b"
    rerender({})
    finishDeletion()
    await flushEffects()

    expect(mockRegistrationInitiate).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.spinner).toBe(false)
  })

  it("starts nothing from a prompt answered after the session was switched", async () => {
    const { result, rerender } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)

    mockToken = "session-of-account-b"
    rerender({})
    await pressAlertButton("OK")

    expect(mockEmailDelete).not.toHaveBeenCalled()
    expect(result.current.spinner).toBe(false)
  })

  /** Covered, not left: the lock on a resume or a route pushed over the screen. */
  it("waits for its screen to be in front again before moving on, when it is covered as the sequence ends", async () => {
    const finishDeletion = deletionHeld()
    const { result } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()

    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.spinner).toBe(false)

    const moveOnOnFocus = focusListeners().at(-1)
    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  /** A newer sequence re-registers the address, so the registration an older one still
   *  owes a covered screen can no longer be validated. */
  it("drops a code screen still owed by an older sequence once a newer one has started", async () => {
    const finishDeletion = deletionHeld()
    const covered = renderHook(() => useEmailReverification())
    covered.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()
    const moveOnOnFocus = focusListeners().at(-1)
    expect(mockNavigate).not.toHaveBeenCalled()

    mockIsFocused.mockReturnValue(true)
    mockEmailDelete.mockResolvedValue({ data: {} })
    const newer = renderHook(() => useEmailReverification())
    newer.result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    act(() => moveOnOnFocus?.())

    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it("shows nothing on a screen the user left while it was waiting to be in front again", async () => {
    const finishDeletion = deletionHeld()
    const { result, unmount } = renderHook(() => useEmailReverification())
    result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    mockIsFocused.mockReturnValue(false)
    finishDeletion()
    await flushEffects()
    const removeMoveOn = lastFocusUnsubscribe()
    expect(removeMoveOn).not.toHaveBeenCalled()

    unmount()

    expect(removeMoveOn).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("leaves every screen put, with the error raised once, when the sequence they wait on fails", async () => {
    const finishDeletion = deletionHeld()
    mockRegistrationInitiate.mockResolvedValue(
      registrationResult({
        errors: [{ message: "Email already taken" }],
        emailRegistrationId: null,
      }),
    )
    const starter = renderHook(() => useEmailReverification())
    starter.result.current.promptReverification(EMAIL)
    await pressOkAndLeaveRunning()
    const joiner = renderHook(() => useEmailReverification())
    await flushEffects()

    finishDeletion()
    await flushEffects()

    expect(Alert.alert).toHaveBeenLastCalledWith("Email already taken")
    expect(jest.mocked(Alert.alert).mock.calls).toHaveLength(2)
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(starter.result.current.spinner).toBe(false)
    expect(joiner.result.current.spinner).toBe(false)

    /** The slot is free again: the next answer starts a fresh sequence. */
    mockEmailDelete.mockResolvedValue({ data: {} })
    joiner.result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 2)

    expect(mockEmailDelete).toHaveBeenCalledTimes(2)
  })

  it("lets a new sequence start once the previous one has moved on to the code screen", async () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")
    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 1)

    expect(mockEmailDelete).toHaveBeenCalledTimes(2)
    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })

  it("lets a new sequence start once the previous one has failed", async () => {
    mockEmailDelete.mockRejectedValueOnce(new Error("network down"))
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")
    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK", 1)

    expect(mockEmailDelete).toHaveBeenCalledTimes(2)
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
  })

  it("leaves the address alone when the prompt is cancelled", async () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("Cancel")

    expect(mockEmailDelete).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("surfaces a registration error instead of moving on", async () => {
    mockRegistrationInitiate.mockResolvedValue(
      registrationResult({
        errors: [{ message: "Email already taken" }],
        emailRegistrationId: null,
      }),
    )

    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")

    expect(Alert.alert).toHaveBeenLastCalledWith("Email already taken")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("stays put when no registration id comes back", async () => {
    mockRegistrationInitiate.mockResolvedValue(
      registrationResult({ errors: [], emailRegistrationId: null }),
    )

    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("swallows a failing delete rather than leaving the screen half-navigated", async () => {
    mockEmailDelete.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL)
    await pressAlertButton("OK")

    expect(mockRegistrationInitiate).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
