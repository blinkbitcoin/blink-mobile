import { Alert, AlertButton } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { silenceConsoleError } from "../helpers/silence-console-error"

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

const pressAlertButton = async (label: string) => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  const button = (buttons as AlertButton[]).find(({ text }) => text === label)

  await button?.onPress?.()
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
    silenceConsoleError()
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
