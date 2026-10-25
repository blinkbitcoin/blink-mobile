import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
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

import { LoginMethodAddition } from "@app/types/two-factor-enforcement"
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
    expect(mockNavigate).toHaveBeenCalledWith("loginMethodCode", {
      addition: LoginMethodAddition.Email,
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

    expect(mockNavigate).toHaveBeenCalledWith("loginMethodCode", {
      addition: LoginMethodAddition.Email,
      email: EMAIL,
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "emailRegistrationValidate",
      expect.anything(),
    )
  })

  it("says the server's refusal under the field", async () => {
    mockEmailInitiate.mockResolvedValue({
      data: {
        userEmailRegistrationInitiate: {
          errors: [{ message: "Already used", code: "SOMETHING" }],
          emailRegistrationId: null,
        },
      },
    })
    jest.spyOn(console, "log").mockImplementation(() => {})

    await submitEmail(undefined)

    expect(screen.getByText("Already used")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("says a registration the server answers without its id", async () => {
    mockEmailInitiate.mockResolvedValue({
      data: { userEmailRegistrationInitiate: { errors: [], emailRegistrationId: null } },
    })

    await submitEmail(undefined)

    expect(
      screen.getByText(LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId()),
    ).toBeTruthy()
  })

  it("says an error when the request fails", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    mockEmailInitiate.mockRejectedValue(new Error("network down"))

    await submitEmail(undefined)

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), "network down")
  })

  it("logs a failure that is not an error, with nothing to show", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    mockEmailInitiate.mockRejectedValue("rejected")

    await submitEmail(undefined)

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  /** The button is off for an address that is not one; the screen checks it again. */
  it("sends nothing for an address that is not one", async () => {
    render(
      <ThemeProvider>
        <TypesafeI18n locale="en">
          <EmailRegistrationInitiateScreen route={makeRoute(undefined)} />
        </TypesafeI18n>
      </ThemeProvider>,
    )
    fireEvent.changeText(
      screen.getByPlaceholderText(LL.EmailRegistrationInitiateScreen.placeholder()),
      "not-an-email",
    )

    await act(async () => {
      await screen.UNSAFE_getByType(GaloyPrimaryButton).props.onPress()
    })

    expect(mockEmailInitiate).not.toHaveBeenCalled()
    expect(
      screen.getByText(LL.EmailRegistrationInitiateScreen.invalidEmail()),
    ).toBeTruthy()
  })

  describe("during the onboarding", () => {
    const pressNotNow = () => {
      render(
        <ThemeProvider>
          <TypesafeI18n locale="en">
            <EmailRegistrationInitiateScreen
              route={makeRoute({ onboarding: true, hasUsername: mockHasUsername })}
            />
          </TypesafeI18n>
        </ThemeProvider>,
      )
      fireEvent.press(screen.getByText(LL.common.notNow()))
    }
    let mockHasUsername = false

    it("goes on to the lightning benefits from Not now", () => {
      mockHasUsername = false
      pressNotNow()

      expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
        screen: "lightningBenefits",
        params: { onboarding: true },
      })
    })

    it("goes on to support from Not now once a username is set", () => {
      mockHasUsername = true
      pressNotNow()

      expect(mockNavigate).toHaveBeenCalledWith("onboarding", { screen: "supportScreen" })
    })
  })
})
