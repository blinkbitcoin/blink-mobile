import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

const mockPopTo = jest.fn()
const mockReplace = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    popTo: mockPopTo,
    replace: mockReplace,
    navigate: mockNavigate,
  }),
}))

const mockUpdateCurrentProfile = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const mockEmailVerify = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailRegistrationValidateMutation: () => [mockEmailVerify, { loading: false }],
}))

jest.mock("@app/components/success-animation", () => {
  const ReactActual = jest.requireActual("react")
  return {
    SuccessIconAnimation: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  }
})

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

import { EmailRegistrationValidateScreen } from "@app/screens/email-registration-screen/email-registration-validate"

jest.useFakeTimers()

loadLocale("en")

const SUCCESS_DELAY = 2000

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const makeRoute = (
  params: RootStackParamList["emailRegistrationValidate"],
): RouteProp<RootStackParamList, "emailRegistrationValidate"> => ({
  key: "emailRegistrationValidate",
  name: "emailRegistrationValidate",
  params,
})

const verifiedResponse = {
  data: {
    userEmailRegistrationValidate: {
      errors: null,
      me: { id: "1", email: { address: "a@b.com", verified: true } },
    },
  },
}

describe("EmailRegistrationValidateScreen — navigation after success", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmailVerify.mockResolvedValue(verifiedResponse)
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
  })

  it("pops back to the existing Settings screen when the flow started from Settings", async () => {
    const { getByTestId } = render(
      wrap(
        <EmailRegistrationValidateScreen
          route={makeRoute({ emailRegistrationId: "id", email: "a@b.com" })}
        />,
      ),
    )

    await act(async () => {
      fireEvent.press(getByTestId("submit-code"))
    })
    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(mockPopTo).toHaveBeenCalledWith("settings")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("replaces with the onboarding flow (not Settings) when started from onboarding", async () => {
    const { getByTestId } = render(
      wrap(
        <EmailRegistrationValidateScreen
          route={makeRoute({
            emailRegistrationId: "id",
            email: "a@b.com",
            onboarding: true,
          })}
        />,
      ),
    )

    await act(async () => {
      fireEvent.press(getByTestId("submit-code"))
    })
    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(mockReplace).toHaveBeenCalledWith("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding: true, canGoBack: false },
    })
    expect(mockPopTo).not.toHaveBeenCalled()
  })
})
