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

  it("passes on the route to return to when it was opened from the two-factor setup", async () => {
    await submitEmail({ returnTo: "twoFactorSetup" })

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      emailRegistrationId: "reg",
      email: EMAIL,
      onboarding: false,
      hasUsername: false,
      returnTo: "twoFactorSetup",
    })
  })
})
