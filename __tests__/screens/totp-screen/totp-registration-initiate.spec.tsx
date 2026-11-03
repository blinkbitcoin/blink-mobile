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

/** The account, as the screen's query returns it: none while it is read, and an error
 *  when the read failed. */
let mockUsername: string | null = "someone"
let mockIsAccountRead = true
let mockAccountReadError: Error | undefined
const mockRereadAccount = jest.fn()
const mockTotpInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTotpRegistrationScreenQuery: () => ({
    data: mockIsAccountRead
      ? { me: { id: "user-id", username: mockUsername } }
      : undefined,
    error: mockAccountReadError,
    refetch: mockRereadAccount,
  }),
  useUserTotpRegistrationInitiateMutation: () => [mockTotpInitiate, { loading: false }],
}))

const mockMarkStart = jest.fn()
jest.mock("@app/screens/totp-screen/hooks/use-totp-registration-flow", () => ({
  useTotpRegistrationFlow: () => ({ markStart: mockMarkStart }),
}))

const mockAcquireScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: (...args: unknown[]) => {
    mockAcquireScreenSecurity(...args)
    return { ready: Promise.resolve(), release: () => Promise.resolve() }
  },
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockCopySecret = jest.fn()
const mockQrCode = jest.fn()
jest.mock("@app/components/totp-export", () => ({
  ...jest.requireActual("@app/components/totp-export"),
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
    mockIsAccountRead = true
    mockAccountReadError = undefined
    mockRereadAccount.mockResolvedValue({})
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

    expect(mockAcquireScreenSecurity).toHaveBeenCalledTimes(1)
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

  /** The backup names it the same way, so the saved key matches its entry. */
  it("labels an account without a username by its user id", async () => {
    mockUsername = null
    await renderScreen()

    expect(mockQrCode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "otpauth://totp/Blink:user-id?secret=SECRET&issuer=Blink",
      }),
    )
  })

  /** Every screen that shows, copies, encodes or passes the key on has the same one. */
  it("takes the key without its spaces, once, as it arrives", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: {
        userTotpRegistrationInitiate: {
          errors: null,
          totpRegistrationId: "reg",
          totpSecret: "SEC RET",
        },
      },
    })
    await renderScreen()

    expect(mockCopySecret).toHaveBeenLastCalledWith(
      expect.objectContaining({ secret: "SECRET" }),
    )
    expect(mockQrCode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "otpauth://totp/Blink:someone?secret=SECRET&issuer=Blink",
      }),
    )
    fireEvent.press(screen.getByText(LL.common.next()))
    expect(mockNavigate).toHaveBeenCalledWith(
      "totpRegistrationValidate",
      expect.objectContaining({ secret: "SECRET" }),
    )
  })

  it("shows a spinner, and no key, until the registration starts", async () => {
    mockTotpInitiate.mockReturnValue(new Promise(() => {}))
    await renderScreen()

    expect(screen.queryByText(LL.common.next())).toBeNull()
    expect(mockCopySecret).not.toHaveBeenCalled()
    expect(mockMarkStart).not.toHaveBeenCalled()
  })

  it("tells the onboarding the registration started", async () => {
    await renderScreen()

    expect(mockMarkStart).toHaveBeenCalledWith(false)
    expect(mockMarkStart).not.toHaveBeenCalledWith(true)
  })

  it("shows a spinner, and no key, until the account is read", async () => {
    mockIsAccountRead = false
    await renderScreen()

    expect(screen.queryByText(LL.common.next())).toBeNull()
    expect(mockQrCode).not.toHaveBeenCalled()
  })

  describe("when the registration cannot start", () => {
    beforeEach(() => {
      mockTotpInitiate.mockRejectedValueOnce(new Error("network down"))
    })

    /** On the screen, rather than in an alert over it as well. */
    it("offers to try again rather than a spinner for good", async () => {
      await renderScreen()

      expect(screen.getByText(LL.common.tryAgain())).toBeTruthy()
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    /** Leaving it is then no dismissal of the prompt that opened the onboarding. */
    it("tells the onboarding the registration could not start", async () => {
      await renderScreen()

      expect(mockMarkStart).toHaveBeenLastCalledWith(true)
    })

    /** Leaving counts again once a try works. */
    it("starts the registration again from Try again, shows its key, and tells the onboarding", async () => {
      await renderScreen()

      await act(async () => {
        fireEvent.press(screen.getByText(LL.common.tryAgain()))
      })

      expect(mockTotpInitiate).toHaveBeenCalledTimes(2)
      expect(mockCopySecret).toHaveBeenLastCalledWith(
        expect.objectContaining({ secret: "SECRET" }),
      )
      expect(mockRereadAccount).not.toHaveBeenCalled()
      expect(mockMarkStart).toHaveBeenLastCalledWith(false)
    })
  })

  describe("when the account cannot be read", () => {
    beforeEach(() => {
      mockIsAccountRead = false
      mockAccountReadError = new Error("network down")
    })

    it("offers to try again, and tells the onboarding", async () => {
      await renderScreen()

      expect(screen.getByText(LL.common.tryAgain())).toBeTruthy()
      expect(mockMarkStart).toHaveBeenLastCalledWith(true)
    })

    it("reads the account again from Try again, leaving the started registration alone", async () => {
      await renderScreen()

      await act(async () => {
        fireEvent.press(screen.getByText(LL.common.tryAgain()))
      })

      expect(mockRereadAccount).toHaveBeenCalledTimes(1)
      expect(mockTotpInitiate).toHaveBeenCalledTimes(1)
    })

    /** The query's own error says so; the retry's rejection has nothing to add. */
    it("swallows a read that fails again", async () => {
      mockRereadAccount.mockRejectedValue(new Error("still down"))
      await renderScreen()

      await act(async () => {
        fireEvent.press(screen.getByText(LL.common.tryAgain()))
      })

      expect(screen.getByText(LL.common.tryAgain())).toBeTruthy()
    })
  })

  it("says so, and shows no key, when the registration comes back without an id", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpSecret: "SECRET" } },
    })
    await renderScreen()

    expect(screen.getByText(LL.common.error())).toBeTruthy()
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })

  it("says so, and reports it, when the registration never reaches the server", async () => {
    const failure = new Error("network down")
    mockTotpInitiate.mockRejectedValue(failure)
    await renderScreen()

    expect(screen.getByText(LL.common.error())).toBeTruthy()
    expect(mockReportError).toHaveBeenCalledWith(
      "Authenticator registration start",
      failure,
    )
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })

  it("reports a registration the server refused", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: {
        userTotpRegistrationInitiate: {
          errors: [{ message: "refused" }],
          totpRegistrationId: null,
          totpSecret: null,
        },
      },
    })
    await renderScreen()

    expect(mockReportError).toHaveBeenCalledWith(
      "Authenticator registration start",
      expect.any(Error),
    )
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })

  it("says so, and shows no key, when the registration comes back without a key", async () => {
    mockTotpInitiate.mockResolvedValue({
      data: { userTotpRegistrationInitiate: { errors: null, totpRegistrationId: "reg" } },
    })
    await renderScreen()

    expect(screen.getByText(LL.common.error())).toBeTruthy()
    expect(screen.queryByText(LL.common.next())).toBeNull()
  })
})
