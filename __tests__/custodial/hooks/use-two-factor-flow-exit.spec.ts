import { act, renderHook } from "@testing-library/react-native"

import { useTwoFactorFlowExit } from "@app/custodial/hooks/use-two-factor-flow-exit"
import {
  ContactField,
  TwoFactorFlowParams,
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
}))

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  unmetTier: TwoFactorTier.Reminder as TwoFactorTier,
  hasAuthenticator: false,
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const MODAL_ORIGIN: TwoFactorPromptOrigin = { prompt: TwoFactorPrompt.SessionModal }

type ExitProps = { flowParams?: TwoFactorFlowParams }

const renderExit = (params?: TwoFactorFlowParams) =>
  renderHook(({ flowParams }: ExitProps) => useTwoFactorFlowExit(flowParams), {
    initialProps: { flowParams: params },
  })

describe("useTwoFactorFlowExit", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    mockEnforcement.hasAuthenticator = false
  })

  it("leaves as the dismissal of the prompt that opened the screen, at its tier", () => {
    const { result } = renderExit({ origin: MODAL_ORIGIN })

    act(() => result.current.leave())

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      MODAL_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("hands the provider a dismissal with no origin when the screen was opened without one", () => {
    const { result } = renderExit()

    act(() => result.current.leave())

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Reminder, undefined)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The setup is still up under the screen, and leaving it is what counts. */
  it("only goes back, charging nothing, when the screen was opened from the setup", () => {
    const { result } = renderExit({ isFromSetup: true })

    act(() => result.current.leave())

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The user was not waving the prompt away: the registration never started. */
  it("only goes back, charging nothing, once the registration could not start", () => {
    const { result, rerender } = renderExit({ origin: MODAL_ORIGIN })

    rerender({ flowParams: { origin: MODAL_ORIGIN, hasFailedStart: true } })
    act(() => result.current.leave())

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** No prompt opened it: the user asked to change a login method. */
  it("only goes back, charging nothing, when opened to change a login method", () => {
    const { result } = renderExit({ contactChange: ContactField.Email })

    act(() => result.current.leave())

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** A code the server accepted after its screen was left still adds the factor. */
  it("charges nothing once the account holds an authenticator", () => {
    const { result, rerender } = renderExit({ origin: MODAL_ORIGIN })

    mockEnforcement.hasAuthenticator = true
    rerender({ flowParams: { origin: MODAL_ORIGIN } })
    act(() => result.current.leave())

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("keeps the tier and the prompt it was opened for once the balance and the params move", () => {
    const { result, rerender } = renderExit({ origin: MODAL_ORIGIN })

    mockEnforcement.unmetTier = TwoFactorTier.HighBalance
    rerender({ flowParams: { origin: { prompt: TwoFactorPrompt.HomeCard } } })
    act(() => result.current.leave())

    expect(result.current.promptTier).toBe(TwoFactorTier.Reminder)
    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      MODAL_ORIGIN,
    )
  })
})
