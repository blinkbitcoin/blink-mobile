import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TotpDeleteValidateScreen } from "@app/screens/totp-screen/totp-delete-validate"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
}))

const mockTotpDelete = jest.fn()
const mockReadAccount = jest.fn()
const mockUseAccountRead = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserTotpDeleteMutation: () => [mockTotpDelete],
  useTotpRegistrationStateLazyQuery: (options: unknown) => {
    mockUseAccountRead(options)
    return [mockReadAccount]
  },
}))

/** A request that may have reached the server, with no answer back. */
const lostAnswer = () =>
  Object.assign(new Error("network down"), { networkError: new Error("offline") })

/** The account as the server reads it back. */
const accountRead = (totpEnabled: boolean) => ({ data: { me: { id: "1", totpEnabled } } })

const mockReportBlocked = jest.fn()
jest.mock("@app/custodial/hooks/use-two-factor-turn-off", () => ({
  useTwoFactorTurnOff: () => ({ reportBlocked: mockReportBlocked }),
}))

jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ openSupport: jest.fn() }),
}))

/** The code field as the screen uses it: what it is told to show, and a submit. */
const mockCodeInput = jest.fn()
jest.mock("@app/components/code-input", () => {
  const ReactActual = jest.requireActual("react")
  const { Pressable, Text } = jest.requireActual("react-native")
  return {
    CodeInput: (props: {
      send: (code: string) => void
      header: string
      errorMessage: string
      loading: boolean
    }) => {
      mockCodeInput(props)
      return ReactActual.createElement(
        Pressable,
        { testID: "submit-code", onPress: () => props.send("123456") },
        ReactActual.createElement(Text, null, props.header),
      )
    },
  }
})

loadLocale("en")
const LL = i18nObject("en")

const answer = (payload: {
  errors: { message: string; code?: string }[]
  me?: object
}) => ({
  data: { userTotpDelete: { me: null, ...payload } },
})

const refusal = (code: string) => answer({ errors: [{ message: "refused", code }] })

const lastCodeInput = () => mockCodeInput.mock.calls.at(-1)?.[0]

const submitCode = async () => {
  render(
    <ContextForScreen>
      <TotpDeleteValidateScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  await act(async () => {
    fireEvent.press(screen.getByTestId("submit-code"))
  })
}

describe("TotpDeleteValidateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockTotpDelete.mockResolvedValue(
      answer({ errors: [], me: { id: "1", totpEnabled: false } }),
    )
    mockReadAccount.mockResolvedValue(accountRead(true))
  })

  it("asks for the code to turn the authenticator off", async () => {
    await submitCode()

    expect(screen.getByText(LL.TwoFactorTurnOff.codeInstruction())).toBeTruthy()
  })

  it("sends the code with the removal", async () => {
    await submitCode()

    expect(mockTotpDelete).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { totpCode: "123456" } } }),
    )
  })

  it("goes back and says so once the authenticator is off", async () => {
    await submitCode()

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith(LL.AccountScreen.totpDeactivated())
  })

  it("says a wrong code under the field, leaving the authenticator on", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_CODE_INVALID"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.TwoFactorTurnOff.codeInvalid())
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("says when the hour's attempts are spent", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOO_MANY_REQUEST"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.TwoFactorTurnOff.tooManyAttempts())
  })

  /** The server checks the balance itself, which can be high while the device's tier is
   *  not. */
  it("points to support when the server finds a balance too high, and reports it", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_REMOVAL_BALANCE_TOO_HIGH"))

    await submitCode()

    expect(screen.getByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeTruthy()
    expect(mockReportBlocked).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("goes back once the support sheet is closed", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_REMOVAL_BALANCE_TOO_HIGH"))
    await submitCode()

    fireEvent.press(screen.getByText(LL.common.close()))

    expect(screen.queryByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeNull()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("says any other refusal in an alert, with the server's words", async () => {
    mockTotpDelete.mockResolvedValue(answer({ errors: [{ message: "Something else" }] }))

    await submitCode()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), "Something else")
    expect(lastCodeInput().errorMessage).toBe("")
  })

  it("says an error when the request fails", async () => {
    mockTotpDelete.mockRejectedValue(new Error("network down"))

    await submitCode()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("shows the field busy while the code is checked, and free after", async () => {
    let settle: (value: unknown) => void = () => {}
    mockTotpDelete.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )
    await submitCode()
    expect(lastCodeInput().loading).toBe(true)

    await act(async () => {
      settle(refusal("TOTP_CODE_INVALID"))
    })

    expect(lastCodeInput().loading).toBe(false)
  })

  describe("when nothing in the answer says how it went", () => {
    it("reads the account back from the server", async () => {
      mockTotpDelete.mockRejectedValue(lostAnswer())

      await submitCode()

      expect(mockUseAccountRead).toHaveBeenCalledWith({ fetchPolicy: "network-only" })
      expect(mockReadAccount).toHaveBeenCalledTimes(1)
    })

    /** The server turned it off, and the answer was lost on the way back. */
    it("goes back and says so when a lost answer had turned it off", async () => {
      mockTotpDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(false))

      await submitCode()

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(Alert.alert).toHaveBeenCalledWith(LL.AccountScreen.totpDeactivated())
    })

    it("says an error when the account cannot be read back either", async () => {
      mockTotpDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockRejectedValue(new Error("still down"))

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    /** An error the server answered with means nothing was removed. */
    it("reads nothing back after an error the server answered with", async () => {
      mockTotpDelete.mockRejectedValue(new Error("rate limited"))

      await submitCode()

      expect(mockReadAccount).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    })

    /** A second try after a lost answer finds nothing left to remove. */
    it("goes back when a refusal finds the authenticator already off", async () => {
      mockTotpDelete.mockResolvedValue(answer({ errors: [{ message: "Not found" }] }))
      mockReadAccount.mockResolvedValue(accountRead(false))

      await submitCode()

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(Alert.alert).not.toHaveBeenCalledWith(LL.common.error(), "Not found")
    })
  })

  it("sends nothing more while a code is checked", async () => {
    mockTotpDelete.mockReturnValue(new Promise(() => {}))
    await submitCode()

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
    })

    expect(mockTotpDelete).toHaveBeenCalledTimes(1)
  })
})
