import { renderHook } from "@testing-library/react-native"

import { useTwoFactorSessionPrompt } from "@app/screens/home-screen/hooks/use-two-factor-session-prompt"
import { TwoFactorSessionPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"

let mockIsFocused = true
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockIsFocused,
}))

/** Taking the start ends its pending state, as the provider does; the hook relies on
 *  that to not raise the modal again once it was resolved. */
const mockConsumeSessionStart = jest.fn(() => {
  mockEnforcement.isSessionStartPending = false
})
const mockEnforcement = {
  isSessionStartPending: false,
  isProtectionGateActive: false,
  requiredPrompt: TwoFactorSessionPrompt.None as TwoFactorSessionPrompt,
  unmetTier: TwoFactorTier.None as TwoFactorTier,
  consumeSessionStart: mockConsumeSessionStart,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorPromptShown = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
}))

const renderPrompt = (isBlocked = false) =>
  renderHook(() => useTwoFactorSessionPrompt({ isBlocked }))

/** The navigator stands the full-screen prompt in whenever the start owes it, unless
 *  told otherwise. */
const sessionStartOwing = (
  prompt: TwoFactorSessionPrompt,
  tier: TwoFactorTier,
  { isGateActive = prompt === TwoFactorSessionPrompt.ProtectionRequired } = {},
) => {
  mockEnforcement.isSessionStartPending = true
  mockEnforcement.requiredPrompt = prompt
  mockEnforcement.unmetTier = tier
  mockEnforcement.isProtectionGateActive = isGateActive
}

/** What a dismissal reported from the home or from a flow does in the provider. */
const dismissalTakesStart = () => {
  mockEnforcement.isSessionStartPending = false
}

describe("useTwoFactorSessionPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
    mockEnforcement.isSessionStartPending = false
    mockEnforcement.isProtectionGateActive = false
    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None
    mockEnforcement.unmetTier = TwoFactorTier.None
  })

  it("does nothing while the session start is not pending", () => {
    const { result } = renderPrompt()

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("takes a session start that owes nothing, so a later balance change waits", () => {
    sessionStartOwing(TwoFactorSessionPrompt.None, TwoFactorTier.Suggested)

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(false)
  })

  it("opens the modal for the recommended tier, logs it as shown and keeps the start pending while it is up", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)

    const { result } = renderPrompt()

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.promptTier).toBe(TwoFactorTier.Recommended)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      prompt: "session_modal",
    })
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("brings the modal down once the dismissal reported from the home takes the start", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()

    dismissalTakesStart()
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("does not reopen the modal for a start still pending behind it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()

    rerender({})
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  /** The modal is hidden with the home while the user is away in a flow it opened;
   *  the start stays pending, so a fresher read can still call for the full-screen
   *  prompt and have the navigator stand it in. */
  it("keeps the modal and the start while the user is away in a flow the modal opened, until the full-screen prompt overtakes it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()

    mockIsFocused = false
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()

    sessionStartOwing(TwoFactorSessionPrompt.ProtectionRequired, TwoFactorTier.Enforced)
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("logs the modal as shown once when it is raised, not again when the home comes back to it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()

    mockIsFocused = false
    rerender({})
    mockIsFocused = true
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
  })

  it("brings the modal down once a dismissal on the flow it opened takes the start", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()
    mockIsFocused = false
    rerender({})

    dismissalTakesStart()
    rerender({})
    mockIsFocused = true
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("leaves a start that owes the full-screen prompt to the navigator: neither takes it nor opens the modal", () => {
    sessionStartOwing(TwoFactorSessionPrompt.ProtectionRequired, TwoFactorTier.Enforced)

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
    expect(result.current.isModalOpen).toBe(false)
  })

  it("takes a start whose full-screen prompt yielded to the wind-down, with no prompt of its own", () => {
    sessionStartOwing(TwoFactorSessionPrompt.ProtectionRequired, TwoFactorTier.Enforced, {
      isGateActive: false,
    })

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(false)
    expect(mockLogTwoFactorPromptShown).not.toHaveBeenCalled()
  })

  it("waits for the home to be focused before taking the session start", () => {
    mockIsFocused = false
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)

    const { result, rerender } = renderPrompt()

    expect(result.current.isModalOpen).toBe(false)

    mockIsFocused = true
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
  })

  it("waits while another home modal blocks it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)

    const { result, rerender } = renderHook(
      ({ isBlocked }: { isBlocked: boolean }) => useTwoFactorSessionPrompt({ isBlocked }),
      { initialProps: { isBlocked: true } },
    )

    expect(result.current.isModalOpen).toBe(false)

    rerender({ isBlocked: false })

    expect(result.current.isModalOpen).toBe(true)
  })

  it("closes the modal on its own once the account no longer needs it, and then takes the start", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()
    expect(result.current.isModalOpen).toBe(true)

    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("closes the modal without taking the start when the full-screen prompt overtakes it, leaving the start to the navigator", () => {
    sessionStartOwing(TwoFactorSessionPrompt.SessionModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()
    expect(result.current.isModalOpen).toBe(true)

    sessionStartOwing(TwoFactorSessionPrompt.ProtectionRequired, TwoFactorTier.Enforced)
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })
})
