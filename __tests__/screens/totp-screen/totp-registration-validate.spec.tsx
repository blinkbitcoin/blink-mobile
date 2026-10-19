import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

const mockPopTo = jest.fn()
const mockReset = jest.fn()
/** The routes under this screen, as the navigator would report them. */
let mockStackRouteNames: string[] = []

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    popTo: mockPopTo,
    reset: mockReset,
    getState: () => ({ routes: mockStackRouteNames.map((name) => ({ name })) }),
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

/** The account's balance tier, as the two-factor enforcement reads it. */
let mockTier = 2
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({ tier: mockTier }),
}))

const mockLogTwoFactorSetupCompleted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupCompleted: (...args: unknown[]) =>
    mockLogTwoFactorSetupCompleted(...args),
}))

jest.mock("@app/components/code-input", () => {
  const ReactActual = jest.requireActual("react")
  const { Pressable, Text } = jest.requireActual("react-native")
  return {
    CodeInput: ({ send }: { send: (code: string) => void }) =>
      ReactActual.createElement(
        Pressable,
        { testID: "submit-code", onPress: () => send("123456") },
        ReactActual.createElement(Text, null, "submit"),
      ),
  }
})

import { TotpRegistrationValidateScreen } from "@app/screens/totp-screen/totp-registration-validate"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const makeRoute = (
  params: RootStackParamList["totpRegistrationValidate"],
): RouteProp<RootStackParamList, "totpRegistrationValidate"> => ({
  key: "totpRegistrationValidate",
  name: "totpRegistrationValidate",
  params,
})

const enabledResponse = {
  data: {
    userTotpRegistrationValidate: {
      errors: null,
      me: { id: "1", totpEnabled: true },
    },
  },
}

/** The success alert is what moves on: its OK button carries the navigation. */
const pressSuccessOk = () => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  const ok = (buttons as AlertButton[])[0]
  ok.onPress?.()
}

const submitCode = async (params: RootStackParamList["totpRegistrationValidate"]) => {
  const { getByTestId } = render(
    wrap(<TotpRegistrationValidateScreen route={makeRoute(params)} />),
  )
  await act(async () => {
    fireEvent.press(getByTestId("submit-code"))
  })
}

describe("TotpRegistrationValidateScreen — navigation after success", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockStackRouteNames = ["Primary", "settings", "totpRegistrationInitiate"]
    mockTotpValidate.mockResolvedValue(enabledResponse)
    mockTier = 2
  })

  it("resets to the account screen when the flow was opened from Settings", async () => {
    await submitCode({ totpRegistrationId: "reg" })
    pressSuccessOk()

    expect(mockReset).toHaveBeenCalledWith({
      routes: [{ name: "Primary" }, { name: "accountScreen" }],
    })
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("pops back into the two-factor setup when the flow was opened from it", async () => {
    mockStackRouteNames = ["Primary", "twoFactorSetup", "totpRegistrationInitiate"]
    await submitCode({ totpRegistrationId: "reg", returnTo: "twoFactorSetup" })
    pressSuccessOk()

    expect(mockPopTo).toHaveBeenCalledWith("twoFactorSetup")
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("ignores a return route the stack does not hold, as a deep link could name one", async () => {
    mockStackRouteNames = ["Primary", "totpRegistrationInitiate"]
    await submitCode({ totpRegistrationId: "reg", returnTo: "twoFactorSetup" })
    pressSuccessOk()

    expect(mockReset).toHaveBeenCalledWith({
      routes: [{ name: "Primary" }, { name: "accountScreen" }],
    })
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("ignores a return route a flow may not return to, even one the stack holds, as a deep link could name it", async () => {
    mockStackRouteNames = ["Primary", "totpRegistrationInitiate"]
    /** What a crafted link hands the screen: a string the type never admits. */
    const returnTo = "totpRegistrationInitiate" as RegistrationReturnRoute
    await submitCode({ totpRegistrationId: "reg", returnTo })
    pressSuccessOk()

    expect(mockReset).toHaveBeenCalledWith({
      routes: [{ name: "Primary" }, { name: "accountScreen" }],
    })
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("sends the code with the registration id and the session token", async () => {
    await submitCode({ totpRegistrationId: "reg" })

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
  it("reports the setup as completed, with the account's tier, once the authenticator is on", async () => {
    mockTier = 3
    await submitCode({ totpRegistrationId: "reg" })

    expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorSetupCompleted).toHaveBeenCalledWith({ tier: 3 })
  })

  it("reports nothing when the code is refused", async () => {
    mockTotpValidate.mockResolvedValue({
      data: {
        userTotpRegistrationValidate: {
          errors: [{ message: "invalid code" }],
          me: { id: "1", totpEnabled: false },
        },
      },
    })
    await submitCode({ totpRegistrationId: "reg" })

    expect(mockLogTwoFactorSetupCompleted).not.toHaveBeenCalled()
  })

  it("reports nothing and says so when the request fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    mockTotpValidate.mockRejectedValue(new Error("network down"))

    await submitCode({ totpRegistrationId: "reg" })

    expect(mockLogTwoFactorSetupCompleted).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
