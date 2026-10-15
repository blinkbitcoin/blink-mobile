import { Alert, AlertButton } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import { useEmailReverification } from "@app/hooks/use-email-reverification"

import { flushEffects } from "../helpers/flush-effects"

const EMAIL = "someone@example.com"

const mockNavigate = jest.fn()
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
  useNavigation: () => ({ navigate: mockNavigate }),
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

const registrationResult = (
  data: Record<string, unknown>,
): { data: Record<string, unknown> } => ({
  data: { userEmailRegistrationInitiate: data },
})

describe("useEmailReverification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    // The give-up branches log on purpose; the assertions cover them.
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    mockEmailDelete.mockResolvedValue({ data: {} })
    mockRegistrationInitiate.mockResolvedValue(
      registrationResult({ errors: [], emailRegistrationId: "registration-id" }),
    )
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
    })
  })

  /** Callers hold their screen on the spinner, so it must not drop between the two
   *  requests, whatever each mutation reports about itself in between. */
  it("reports the sequence as running from the first request until the last has answered", async () => {
    let finishDeletion = () => {}
    let finishRegistration = () => {}
    mockEmailDelete.mockReturnValue(
      new Promise<void>((resolve) => {
        finishDeletion = resolve
      }),
    )
    mockRegistrationInitiate.mockReturnValue(
      new Promise((resolve) => {
        finishRegistration = () =>
          resolve(
            registrationResult({ errors: [], emailRegistrationId: "registration-id" }),
          )
      }),
    )
    const { result } = renderHook(() => useEmailReverification())
    expect(result.current.spinner).toBe(false)

    result.current.promptReverification(EMAIL)
    await act(async () => {
      alertButton("OK")?.onPress?.()
    })
    expect(result.current.spinner).toBe(true)

    finishDeletion()
    await flushEffects()
    expect(result.current.spinner).toBe(true)

    finishRegistration()
    await flushEffects()
    expect(result.current.spinner).toBe(false)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it("hands the code screen the route to return to, for a caller the flow must come back to", async () => {
    const { result } = renderHook(() => useEmailReverification())

    result.current.promptReverification(EMAIL, "twoFactorSetup")
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
