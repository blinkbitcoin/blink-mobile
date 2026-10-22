import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

type BeforeRemoveEvent = {
  data: { action: { type: string } }
  preventDefault: () => void
}

const mockSetOptions = jest.fn()
const mockUnsubscribe = jest.fn()
/** The screen's `beforeRemove` listener, as the navigator would hold it. */
let mockBeforeRemove: ((event: BeforeRemoveEvent) => void) | undefined
/** One navigation object for every render, as the navigator hands a screen. */
const mockNavigation = {
  setOptions: (...args: unknown[]) => mockSetOptions(...args),
  addListener: (_name: string, listener: (event: BeforeRemoveEvent) => void) => {
    mockBeforeRemove = listener
    return mockUnsubscribe
  },
}
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
}))

/** A removal of the screen by the given action, and whether the screen refused it. */
const isRemovalRefused = (type: string): boolean => {
  const preventDefault = jest.fn()
  mockBeforeRemove?.({ data: { action: { type } }, preventDefault })
  return preventDefault.mock.calls.length > 0
}

const mockShowBackup = jest.fn()
/** The prompt the registration was started from, as the flow reads it off the stack. */
let mockRegistrationPrompt: string | undefined
jest.mock("@app/screens/totp-screen/hooks/use-totp-registration-flow", () => ({
  useTotpRegistrationFlow: () => ({
    showBackup: mockShowBackup,
    leave: jest.fn(),
    registrationPrompt: () => mockRegistrationPrompt,
  }),
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({ appConfig: { token: "session-token" } }),
}))

const mockTotpValidate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserTotpRegistrationValidateMutation: () => [mockTotpValidate, { loading: false }],
}))

/** The account's balance tier, as the two-factor enforcement reads it, and whether the
 *  prompts apply to it. */
let mockTier = 2
let mockIsEnforced = true
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({ tier: mockTier, isEnforced: mockIsEnforced }),
}))

const mockLogTwoFactorSetupCompleted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupCompleted: (...args: unknown[]) =>
    mockLogTwoFactorSetupCompleted(...args),
}))

const mockCodeInputError = jest.fn()
jest.mock("@app/components/code-input", () => {
  const ReactActual = jest.requireActual("react")
  const { Pressable, Text } = jest.requireActual("react-native")
  return {
    CodeInput: ({
      send,
      errorMessage,
    }: {
      send: (code: string) => void
      errorMessage: string
    }) => {
      mockCodeInputError(errorMessage)
      return ReactActual.createElement(
        Pressable,
        { testID: "submit-code", onPress: () => send("123456") },
        ReactActual.createElement(Text, null, "submit"),
      )
    },
  }
})

import { TotpRegistrationValidateScreen } from "@app/screens/totp-screen/totp-registration-validate"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const ROUTE_PARAMS: RootStackParamList["totpRegistrationValidate"] = {
  totpRegistrationId: "reg",
  secret: "SECRET",
}

const makeRoute = (): RouteProp<RootStackParamList, "totpRegistrationValidate"> => ({
  key: "totpRegistrationValidate",
  name: "totpRegistrationValidate",
  params: ROUTE_PARAMS,
})

const enabledResponse = {
  data: {
    userTotpRegistrationValidate: {
      errors: null,
      me: { id: "1", totpEnabled: true },
    },
  },
}

const submitCode = async () => {
  const { getByTestId } = render(
    wrap(<TotpRegistrationValidateScreen route={makeRoute()} />),
  )
  await act(async () => {
    fireEvent.press(getByTestId("submit-code"))
  })
}

describe("TotpRegistrationValidateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockTotpValidate.mockResolvedValue(enabledResponse)
    mockTier = 2
    mockIsEnforced = true
    mockRegistrationPrompt = undefined
    mockBeforeRemove = undefined
  })

  it("moves on to the backup of the setup key once the authenticator is on", async () => {
    await submitCode()

    expect(mockShowBackup).toHaveBeenCalledWith({ secret: "SECRET", userId: "1" })
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("sends the code with the registration id and the session token", async () => {
    await submitCode()

    expect(mockTotpValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            totpCode: "123456",
            totpRegistrationId: "reg",
            authToken: "session-token",
          },
        },
      }),
    )
  })

  /** Measured one week after the release: how many accounts added the authenticator,
   *  and at which tier. */
  it("reports the setup as completed, with the account's tier and the prompt that led to it, once the authenticator is on", async () => {
    mockTier = 3
    mockRegistrationPrompt = "session_modal"
    await submitCode()

    expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledWith({
      tier: 3,
      isEnforced: true,
      prompt: "session_modal",
    })
  })

  /** Started from the settings with the prompts switched off: the tier then says
   *  nothing about a balance, which the event tells apart. */
  it("reports a setup from the settings with no prompt, and whether the prompts applied", async () => {
    mockTier = 0
    mockIsEnforced = false
    await submitCode()

    expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledWith({
      tier: 0,
      isEnforced: false,
      prompt: undefined,
    })
  })

  it("shows the refusal and stays on the code when the code is refused", async () => {
    mockTotpValidate.mockResolvedValue({
      data: {
        userTotpRegistrationValidate: {
          errors: [{ message: "invalid code" }],
          me: { id: "1", totpEnabled: false },
        },
      },
    })
    await submitCode()

    expect(mockCodeInputError).toHaveBeenLastCalledWith("invalid code")
    expect(mockLogTwoFactorSetupCompleted).not.toHaveBeenCalled()
    expect(mockShowBackup).not.toHaveBeenCalled()
  })

  it("reports nothing and says so when the request fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    mockTotpValidate.mockRejectedValue(new Error("network down"))

    await submitCode()

    expect(mockLogTwoFactorSetupCompleted).not.toHaveBeenCalled()
    expect(mockShowBackup).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  describe("while the code is checked", () => {
    /** A code accepted after the user left would enable the authenticator with its
     *  setup key gone: the backup is the key's only safekeeping. */
    it("refuses the user's own ways back and switches the swipe off", async () => {
      let answer: (value: typeof enabledResponse) => void = () => {}
      mockTotpValidate.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      const { getByTestId } = render(
        wrap(<TotpRegistrationValidateScreen route={makeRoute()} />),
      )
      await act(async () => {
        fireEvent.press(getByTestId("submit-code"))
      })

      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })
      expect(isRemovalRefused("GO_BACK")).toBe(true)
      expect(isRemovalRefused("POP")).toBe(true)

      await act(async () => {
        answer(enabledResponse)
      })

      expect(mockShowBackup).toHaveBeenCalledWith({ secret: "SECRET", userId: "1" })
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
    })

    /** A logout or an account switch the app dispatches itself must still go through. */
    it("lets a reset the app dispatched take the screen", async () => {
      mockTotpValidate.mockReturnValue(new Promise(() => {}))
      const { getByTestId } = render(
        wrap(<TotpRegistrationValidateScreen route={makeRoute()} />),
      )
      await act(async () => {
        fireEvent.press(getByTestId("submit-code"))
      })

      expect(isRemovalRefused("RESET")).toBe(false)
    })

    /** A request that never settles must not keep the user on the screen for good. */
    it("gives the ways back again once a check has taken too long", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] })
      try {
        mockTotpValidate.mockReturnValue(new Promise(() => {}))
        const { getByTestId } = render(
          wrap(<TotpRegistrationValidateScreen route={makeRoute()} />),
        )
        await act(async () => {
          fireEvent.press(getByTestId("submit-code"))
        })
        expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })

        await act(async () => {
          jest.advanceTimersByTime(20_000)
        })

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
        expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
      } finally {
        jest.useRealTimers()
      }
    })

    /** An answer can land once the registration is off the stack: the prompt it was
     *  started from is read before. */
    it("reports the prompt the registration was started from, read before the answer", async () => {
      let answer: (value: typeof enabledResponse) => void = () => {}
      mockTotpValidate.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      mockRegistrationPrompt = "session_modal"
      const { getByTestId } = render(
        wrap(<TotpRegistrationValidateScreen route={makeRoute()} />),
      )
      await act(async () => {
        fireEvent.press(getByTestId("submit-code"))
      })
      mockRegistrationPrompt = undefined

      await act(async () => {
        answer(enabledResponse)
      })

      expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "session_modal" }),
      )
    })

    it("leaves the ways back alone before a code is sent", () => {
      render(wrap(<TotpRegistrationValidateScreen route={makeRoute()} />))

      expect(mockBeforeRemove).toBeUndefined()
      expect(mockSetOptions).not.toHaveBeenCalled()
    })
  })
})
