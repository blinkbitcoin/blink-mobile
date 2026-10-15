import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
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
})
