import { act, renderHook } from "@testing-library/react-native"

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
  requiredPrompt: TwoFactorSessionPrompt.None as TwoFactorSessionPrompt,
  unmetTier: TwoFactorTier.None as TwoFactorTier,
  consumeSessionStart: mockConsumeSessionStart,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const renderPrompt = (isBlocked = false) =>
  renderHook(() => useTwoFactorSessionPrompt({ isBlocked }))

const sessionStartOwing = (prompt: TwoFactorSessionPrompt, tier: TwoFactorTier) => {
  mockEnforcement.isSessionStartPending = true
  mockEnforcement.requiredPrompt = prompt
  mockEnforcement.unmetTier = tier
}

describe("useTwoFactorSessionPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
    mockEnforcement.isSessionStartPending = false
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

  it("opens the modal for the recommended tier and keeps the start pending while it is up", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)

    const { result } = renderPrompt()

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.promptTier).toBe(TwoFactorTier.Recommended)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("takes the start when the modal is resolved", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)
    const { result } = renderPrompt()

    act(() => result.current.closeModal())

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("does not reopen the modal for a start still pending behind it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()

    rerender({})
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })

  it("leaves a start that owes the full-screen prompt to the navigator: neither takes it nor opens the modal", () => {
    sessionStartOwing(TwoFactorSessionPrompt.ProtectionRequired, TwoFactorTier.Enforced)

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
    expect(result.current.isModalOpen).toBe(false)
  })

  it("waits for the home to be focused before taking the session start", () => {
    mockIsFocused = false
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)

    const { result, rerender } = renderPrompt()

    expect(result.current.isModalOpen).toBe(false)

    mockIsFocused = true
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
  })

  it("waits while another home modal blocks it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)

    const { result, rerender } = renderHook(
      ({ isBlocked }: { isBlocked: boolean }) => useTwoFactorSessionPrompt({ isBlocked }),
      { initialProps: { isBlocked: true } },
    )

    expect(result.current.isModalOpen).toBe(false)

    rerender({ isBlocked: false })

    expect(result.current.isModalOpen).toBe(true)
  })

  it("closes the modal on its own once the account no longer needs it, and then takes the start", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()
    expect(result.current.isModalOpen).toBe(true)

    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("closes the modal without taking the start when the full-screen prompt overtakes it, leaving the start to the navigator", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Recommended)
    const { result, rerender } = renderPrompt()
    expect(result.current.isModalOpen).toBe(true)

    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.ProtectionRequired
    mockEnforcement.unmetTier = TwoFactorTier.Enforced
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
  })
})
