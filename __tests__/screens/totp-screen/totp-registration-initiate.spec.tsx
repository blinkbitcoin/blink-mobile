import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

/** The screen's width, as the window reports it. */
const mockWindow = { width: 360, height: 800, scale: 2, fontScale: 1 }
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}))

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

/** The instance's name, which the QR code issues the key under. */
let mockInstanceName = "Blink"
jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: mockInstanceName } } }),
}))

/** The username the account has, as the screen's query returns it. */
let mockUsername: string | null = "someone"
const mockTotpInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTotpRegistrationScreenQuery: () => ({ data: { me: { username: mockUsername } } }),
  useUserTotpRegistrationInitiateMutation: () => [mockTotpInitiate, { loading: false }],
}))

const mockEnableScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: (...args: unknown[]) => {
    mockEnableScreenSecurity(...args)
    return Promise.resolve()
  },
  disableScreenSecurity: () => Promise.resolve(),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockCopySecret = jest.fn()
const mockQrCode = jest.fn()
jest.mock("@app/components/totp-export", () => ({
  QrCodeComponent: (props: unknown) => {
    mockQrCode(props)
    return null
  },
  CopySecretComponent: (props: unknown) => {
    mockCopySecret(props)
    return null
  },
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

const renderScreen = async () => {
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <TotpRegistrationInitiateScreen />
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {})
}

describe("TotpRegistrationInitiateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockUsername = "someone"
    mockInstanceName = "Blink"
    mockWindow.width = 360
    mockTotpInitiate.mockResolvedValue(initiatedResponse)
  })

  it("hands the code screen the registration it started and its setup key", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationValidate", {
      totpRegistrationId: "reg",
      secret: "SECRET",
    })
  })

  it("shows the setup key first, highlighted, and the QR code for another device after it", async () => {
    await renderScreen()

    expect(screen.getByText(LL.AuthenticatorOnboarding.keyInstruction())).toBeTruthy()
    expect(screen.getByText(LL.AuthenticatorOnboarding.qrInstruction())).toBeTruthy()
    expect(mockCopySecret).toHaveBeenLastCalledWith(
      expect.objectContaining({ secret: "SECRET", isHighlighted: true }),
    )
  })

  it("keeps the key and its QR code out of screenshots, recordings and the app switcher", async () => {
    await renderScreen()

    expect(mockEnableScreenSecurity).toHaveBeenCalledTimes(1)
  })

  it("encodes the account and the key in the QR code, under the instance's name", async () => {
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "otpauth://totp/Blink:someone?secret=SECRET&issuer=Blink",
      }),
    )
  })

  /** The frame is half the screen's width, as in the design, with 16 px of padding and
   *  border on each side of the code. */
  it("draws the code at half the screen's width, as the design does", async () => {
    mockWindow.width = 411
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(expect.objectContaining({ size: 174 }))
  })

  it("caps the code at the size it had before, on a screen as wide as a tablet's", async () => {
    mockWindow.width = 800
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(expect.objectContaining({ size: 208 }))
  })

  /** An instance named with a space or a colon would otherwise break the label. */
  it("encodes the instance's name in the label as well as in the issuer", async () => {
    mockInstanceName = "Blink: Test"
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value:
          "otpauth://totp/Blink%3A%20Test:someone?secret=SECRET&issuer=Blink%3A%20Test",
      }),
    )
  })

  it("labels an account without a username as blink", async () => {
    mockUsername = null
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "otpauth://totp/Blink:blink?secret=SECRET&issuer=Blink",
      }),
    )
  })

  it("shows a spinner, and no key, until the registration starts", async () => {
    mockTotpInitiate.mockReturnValue(new Promise(() => {}))
    await renderScreen()

    expect(screen.queryByText(LL.common.next())).toBeNull()
    expect(mockCopySecret).not.toHaveBeenCalled()
  })

  it("says so, and shows no key, when the registration comes back without an id", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpSecret: "SECRET" } },
    })
    await renderScreen()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })

  it("says so, and reports it, when the registration never reaches the server", async () => {
    const failure = new Error("network down")
    mockTotpInitiate.mockRejectedValue(failure)
    await renderScreen()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    expect(mockReportError).toHaveBeenCalledWith(
      "Authenticator registration start",
      failure,
    )
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })

  it("says so, and shows no key, when the registration comes back without a key", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpRegistrationId: "reg" } },
    })
    await renderScreen()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })
})
