import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { CommonActions, NavigationState } from "@react-navigation/native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TotpDeleteValidateScreen } from "@app/screens/totp-screen/totp-delete-validate"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const ROUTE_KEY = "totpDeleteValidate-1"

const mockDispatch = jest.fn()
const mockSetOptions = jest.fn()
const mockUnsubscribe = jest.fn()
type RemoveEvent = { data: { action: { type: string } }; preventDefault: () => void }
/** The listener the screen holds the ways back with, while it does. */
let mockBeforeRemove: ((event: RemoveEvent) => void) | undefined
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: mockDispatch,
    setOptions: mockSetOptions,
    addListener: (event: string, listener: (event: RemoveEvent) => void) => {
      if (event === "beforeRemove") mockBeforeRemove = listener
      return () => {
        mockUnsubscribe()
        mockBeforeRemove = undefined
      }
    },
  }),
  useRoute: () => ({ key: ROUTE_KEY }),
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
/** The turn-off decision as the provider has it at each render. */
const mockTurnOff = { isTurnOffBlocked: false, isTurnOffDecided: true }
jest.mock("@app/custodial/hooks/use-two-factor-turn-off", () => ({
  useTwoFactorTurnOff: () => ({ ...mockTurnOff, reportBlocked: mockReportBlocked }),
}))

/** The stack the screen sits in, with the app lock pushed over it. */
const STACK = {
  key: "stack",
  index: 2,
  routes: [
    { key: "settings-0", name: "settings" },
    { key: ROUTE_KEY, name: "totpDeleteValidate" },
    { key: "authenticationCheck-2", name: "authenticationCheck" },
  ],
}

/** What the dispatched action does to the stack. */
const stackAfterLeaving = () => {
  const buildAction = mockDispatch.mock.calls.at(-1)?.[0]
  return buildAction(STACK as unknown as NavigationState)
}

/** Whether the screen left: it takes only itself off the stack. */
const hasLeft = () => mockDispatch.mock.calls.length > 0

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
    mockTurnOff.isTurnOffBlocked = false
    mockTurnOff.isTurnOffDecided = true
    mockBeforeRemove = undefined
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

  it("leaves and says so once the authenticator is off", async () => {
    await submitCode()

    expect(hasLeft()).toBe(true)
    expect(Alert.alert).toHaveBeenCalledWith(LL.AccountScreen.totpDeactivated())
  })

  /** The app lock can go up over the screen while the code is checked. */
  it("takes only itself off the stack, leaving the screens above it", async () => {
    await submitCode()

    expect(stackAfterLeaving()).toEqual(
      CommonActions.reset({
        ...STACK,
        index: 1,
        routes: [STACK.routes[0], STACK.routes[2]],
      } as unknown as NavigationState),
    )
  })

  it("says a wrong code under the field, leaving the authenticator on", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_CODE_INVALID"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.TwoFactorTurnOff.codeInvalid())
    expect(hasLeft()).toBe(false)
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
    expect(hasLeft()).toBe(false)
  })

  it("leaves once the support sheet is closed", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_REMOVAL_BALANCE_TOO_HIGH"))
    await submitCode()

    fireEvent.press(screen.getByText(LL.common.close()))

    expect(screen.queryByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeNull()
    expect(stackAfterLeaving().payload.routes).toEqual([STACK.routes[0], STACK.routes[2]])
  })

  /** Close and the backdrop can both answer one gesture: the screens under it stay. */
  it("leaves only once when the sheet is closed twice in a row", async () => {
    mockTotpDelete.mockResolvedValue(refusal("TOTP_REMOVAL_BALANCE_TOO_HIGH"))
    await submitCode()

    act(() => {
      fireEvent.press(screen.getByText(LL.common.close()))
      fireEvent.press(screen.getByTestId("backdrop"))
    })

    const [[leaveFirst], [leaveSecond]] = mockDispatch.mock.calls
    const afterFirst = leaveFirst(STACK as unknown as NavigationState).payload
    const afterSecond = leaveSecond(afterFirst as unknown as NavigationState).payload
    expect(afterSecond.routes).toEqual(afterFirst.routes)
    expect(afterSecond.routes).toEqual([STACK.routes[0], STACK.routes[2]])
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

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), undefined)
    expect(hasLeft()).toBe(false)
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

      expect(hasLeft()).toBe(true)
      expect(Alert.alert).toHaveBeenCalledWith(LL.AccountScreen.totpDeactivated())
    })

    it("says an error when the account cannot be read back either", async () => {
      mockTotpDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockRejectedValue(new Error("still down"))

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), undefined)
      expect(hasLeft()).toBe(false)
    })

    /** An error the server answered with means nothing was removed. */
    it("reads nothing back after an error the server answered with", async () => {
      mockTotpDelete.mockRejectedValue(new Error("rate limited"))

      await submitCode()

      expect(mockReadAccount).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), undefined)
    })

    /** A second try after a lost answer finds nothing left to remove. */
    it("goes back when a refusal finds the authenticator already off", async () => {
      mockTotpDelete.mockResolvedValue(answer({ errors: [{ message: "Not found" }] }))
      mockReadAccount.mockResolvedValue(accountRead(false))

      await submitCode()

      expect(hasLeft()).toBe(true)
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

  describe("the turn-off decision, read again when the code is sent", () => {
    it("sends no code while the tier reached is still unknown", async () => {
      mockTurnOff.isTurnOffDecided = false

      await submitCode()

      expect(mockTotpDelete).not.toHaveBeenCalled()
      expect(lastCodeInput().errorMessage).toBe(LL.errors.generic())
    })

    /** The balance can cross the high tier while the screen is open, and drop again
     *  before the code is sent: the tier reached still holds. */
    it("sends no code once the tier reached blocks it after the screen opened", async () => {
      render(
        <ContextForScreen>
          <TotpDeleteValidateScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      mockTurnOff.isTurnOffBlocked = true
      screen.rerender(
        <ContextForScreen>
          <TotpDeleteValidateScreen />
        </ContextForScreen>,
      )
      await act(async () => {
        fireEvent.press(screen.getByTestId("submit-code"))
      })

      expect(mockTotpDelete).not.toHaveBeenCalled()
      expect(mockReportBlocked).toHaveBeenCalledTimes(1)
      expect(screen.getByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeTruthy()
    })
  })

  describe("while the code is checked", () => {
    const holdRequest = () => {
      let settle: (value: unknown) => void = () => {}
      mockTotpDelete.mockReturnValue(
        new Promise((resolve) => {
          settle = resolve
        }),
      )
      return (value: unknown) => settle(value)
    }

    it("holds the user's ways back, and lets them go with the answer", async () => {
      const settle = holdRequest()
      await submitCode()

      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })
      const preventDefault = jest.fn()
      mockBeforeRemove?.({ data: { action: { type: "GO_BACK" } }, preventDefault })
      expect(preventDefault).toHaveBeenCalledTimes(1)

      await act(async () => settle(refusal("TOTP_CODE_INVALID")))

      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    /** A logout or an account switch resets the stack, and goes through. */
    it("lets through what the app dispatches itself", async () => {
      holdRequest()
      await submitCode()

      const preventDefault = jest.fn()
      mockBeforeRemove?.({ data: { action: { type: "RESET" } }, preventDefault })

      expect(preventDefault).not.toHaveBeenCalled()
    })

    it("lets the ways back go once a check takes too long", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] })
      try {
        holdRequest()
        render(
          <ContextForScreen>
            <TotpDeleteValidateScreen />
          </ContextForScreen>,
        )
        await act(async () => {
          fireEvent.press(screen.getByTestId("submit-code"))
        })
        expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })

        await act(async () => {
          jest.advanceTimersByTime(20_000)
        })

        expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
        expect(mockBeforeRemove).toBeUndefined()
      } finally {
        jest.useRealTimers()
      }
    })

    /** The user left once the hold let go; the answer must not move the screen they
     *  are on now, nor say anything over it. */
    it("does nothing with a removal that lands once the screen is gone", async () => {
      const settle = holdRequest()
      await submitCode()
      screen.unmount()

      await act(async () =>
        settle(answer({ errors: [], me: { id: "1", totpEnabled: false } })),
      )

      expect(hasLeft()).toBe(false)
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    /** The user came back to a new code screen once the hold let go: the old answer
     *  must not move it, and the new one checks its own code. */
    it("leaves a new code screen alone when the old one's answer lands", async () => {
      const settleOld = holdRequest()
      await submitCode()
      screen.unmount()

      mockTotpDelete.mockReturnValue(new Promise(() => {}))
      await submitCode()
      expect(mockTotpDelete).toHaveBeenCalledTimes(2)

      await act(async () =>
        settleOld(answer({ errors: [], me: { id: "1", totpEnabled: false } })),
      )

      expect(hasLeft()).toBe(false)
      expect(Alert.alert).not.toHaveBeenCalled()
      expect(lastCodeInput().loading).toBe(true)
    })

    /** A logout or an account switch resets the stack, which takes the screen away. */
    it("does nothing with an answer that lands after an account switch", async () => {
      const settle = holdRequest()
      await submitCode()
      const preventDefault = jest.fn()
      mockBeforeRemove?.({ data: { action: { type: "RESET" } }, preventDefault })
      expect(preventDefault).not.toHaveBeenCalled()
      screen.unmount()

      await act(async () =>
        settle(answer({ errors: [], me: { id: "1", totpEnabled: false } })),
      )

      expect(hasLeft()).toBe(false)
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    it("says no error once the screen is gone", async () => {
      let fail: (reason: unknown) => void = () => {}
      mockTotpDelete.mockReturnValue(
        new Promise((_resolve, reject) => {
          fail = reject
        }),
      )
      await submitCode()
      screen.unmount()

      await act(async () => fail(new Error("rate limited")))

      expect(Alert.alert).not.toHaveBeenCalled()
    })
  })

  it("says an error when a lost answer left the authenticator on", async () => {
    mockTotpDelete.mockRejectedValue(lostAnswer())
    mockReadAccount.mockResolvedValue(accountRead(true))

    await submitCode()

    expect(mockReadAccount).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), undefined)
    expect(hasLeft()).toBe(false)
  })

  it("reads the account back when the answer carries nothing", async () => {
    mockTotpDelete.mockResolvedValue({ data: null })
    mockReadAccount.mockResolvedValue({ data: null })

    await submitCode()

    expect(mockReadAccount).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), undefined)
    expect(hasLeft()).toBe(false)
  })
})
