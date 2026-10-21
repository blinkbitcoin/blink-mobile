import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

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
})
