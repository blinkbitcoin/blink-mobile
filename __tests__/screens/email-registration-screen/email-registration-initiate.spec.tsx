import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockEmailInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailRegistrationInitiateMutation: () => [mockEmailInitiate, { loading: false }],
}))

let mockHasAuthenticator = false
jest.mock("@app/screens/settings-screen/account/login-methods-hook", () => ({
  useLoginMethods: () => ({ hasAuthenticator: mockHasAuthenticator }),
}))

import { ContactChangeStep } from "@app/types/two-factor-enforcement"
import { EmailRegistrationInitiateScreen } from "@app/screens/email-registration-screen/email-registration-initiate"

loadLocale("en")
const LL = i18nObject("en")

const EMAIL = "someone@example.com"

const makeRoute = (
  params: RootStackParamList["emailRegistrationInitiate"],
): RouteProp<RootStackParamList, "emailRegistrationInitiate"> => ({
  key: "emailRegistrationInitiate",
  name: "emailRegistrationInitiate",
  params,
})

const initiatedResponse = {
  data: {
    userEmailRegistrationInitiate: { errors: [], emailRegistrationId: "reg" },
  },
}

const submitEmail = async (params: RootStackParamList["emailRegistrationInitiate"]) => {
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <EmailRegistrationInitiateScreen route={makeRoute(params)} />
      </TypesafeI18n>
    </ThemeProvider>,
  )
  fireEvent.changeText(
    screen.getByPlaceholderText(LL.EmailRegistrationInitiateScreen.placeholder()),
    EMAIL,
  )
  await act(async () => {
    fireEvent.press(screen.getByText(LL.EmailRegistrationInitiateScreen.send()))
  })
}

describe("EmailRegistrationInitiateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasAuthenticator = false
    mockEmailInitiate.mockResolvedValue(initiatedResponse)
  })

  it("hands the code screen the registration it started", async () => {
    await submitEmail(undefined)

    expect(mockEmailInitiate).toHaveBeenCalledWith({
      variables: { input: { email: EMAIL } },
    })
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      emailRegistrationId: "reg",
      email: EMAIL,
      onboarding: false,
      hasUsername: false,
    })
  })

  it("asks for the authenticator's code first on an account that has one", async () => {
    mockHasAuthenticator = true

    await submitEmail(undefined)

    expect(mockEmailInitiate).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("contactChangeCode", {
      step: ContactChangeStep.EmailAdd,
      email: EMAIL,
    })
  })

  it("asks for the code when the server wants one the account did not show yet", async () => {
    mockEmailInitiate.mockResolvedValue({
      data: {
        userEmailRegistrationInitiate: {
          errors: [{ message: "required", code: "TOTP_CODE_REQUIRED" }],
          emailRegistrationId: null,
        },
      },
    })

    await submitEmail(undefined)

    expect(mockNavigate).toHaveBeenCalledWith("contactChangeCode", {
      step: ContactChangeStep.EmailAdd,
      email: EMAIL,
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "emailRegistrationValidate",
      expect.anything(),
    )
  })
})
