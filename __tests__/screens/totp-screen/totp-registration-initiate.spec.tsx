import React from "react"
import { Alert } from "react-native"
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

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

const mockTotpInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTotpRegistrationScreenQuery: () => ({ data: { me: { username: "someone" } } }),
  useUserTotpRegistrationInitiateMutation: () => [mockTotpInitiate, { loading: false }],
}))

jest.mock("@app/components/totp-export", () => ({
  QrCodeComponent: () => null,
  CopySecretComponent: () => null,
}))

import { TotpRegistrationInitiateScreen } from "@app/screens/totp-screen/totp-registration-initiate"

loadLocale("en")
const LL = i18nObject("en")

const initiatedResponse = {
  data: {
    userTotpRegistrationInitiate: {
      errors: null,
      totpRegistrationId: "reg",
      totpSecret: "SECRET",
    },
  },
}

const makeRoute = (
  params: RootStackParamList["totpRegistrationInitiate"],
): RouteProp<RootStackParamList, "totpRegistrationInitiate"> => ({
  key: "totpRegistrationInitiate",
  name: "totpRegistrationInitiate",
  params,
})

const renderScreen = async (params: RootStackParamList["totpRegistrationInitiate"]) => {
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <TotpRegistrationInitiateScreen route={makeRoute(params)} />
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {})
}

describe("TotpRegistrationInitiateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTotpInitiate.mockResolvedValue(initiatedResponse)
  })

  it("hands the code screen the registration it started", async () => {
    await renderScreen(undefined)

    fireEvent.press(screen.getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationValidate", {
      totpRegistrationId: "reg",
    })
  })

  it("passes on the route to return to when it was opened from the two-factor setup", async () => {
    await renderScreen({ returnTo: "twoFactorSetup" })

    fireEvent.press(screen.getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationValidate", {
      totpRegistrationId: "reg",
      returnTo: "twoFactorSetup",
    })
  })

  it("says so, and offers no next step, when the registration comes back without an id", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpSecret: "SECRET" } },
    })

    await renderScreen(undefined)

    expect(alert).toHaveBeenCalledWith(LL.common.error())
    expect(screen.queryByText(LL.common.next())).toBeNull()
    alert.mockRestore()
  })

  it("says so, and offers no next step, when the registration comes back without a secret", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpRegistrationId: "reg" } },
    })

    await renderScreen(undefined)

    expect(alert).toHaveBeenCalledWith(LL.common.error())
    expect(screen.queryByText(LL.common.next())).toBeNull()
    alert.mockRestore()
  })

  it("passes on the prompt that led to the registration, for the setup it reports", async () => {
    await renderScreen({ returnTo: "Primary", prompt: "protection_required_screen" })

    fireEvent.press(screen.getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationValidate", {
      totpRegistrationId: "reg",
      returnTo: "Primary",
      prompt: "protection_required_screen",
    })
  })
})
