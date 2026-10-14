import { act, renderHook } from "@testing-library/react-native"

import { useTwoFactorSessionPrompt } from "@app/screens/home-screen/hooks/use-two-factor-session-prompt"
import { TwoFactorSessionPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"

let mockIsFocused = true
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockIsFocused,
}))

const mockConsumeSessionStart = jest.fn()
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
    sessionStartOwing(TwoFactorSessionPrompt.None, TwoFactorTier.Nudge)

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(false)
  })

  it("opens the modal for the required tier and takes the session start", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Required)

    const { result } = renderPrompt()

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.promptTier).toBe(TwoFactorTier.Required)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("leaves the full-screen prompt to the navigator: takes the start, opens no modal", () => {
    sessionStartOwing(
      TwoFactorSessionPrompt.ProtectionRequired,
      TwoFactorTier.Authenticator,
    )

    const { result } = renderPrompt()

    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(false)
  })

  it("waits for the home to be focused before taking the session start", () => {
    mockIsFocused = false
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Required)

    const { result, rerender } = renderPrompt()

    expect(result.current.isModalOpen).toBe(false)
    expect(mockConsumeSessionStart).not.toHaveBeenCalled()

    mockIsFocused = true
    rerender({})

    expect(result.current.isModalOpen).toBe(true)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("waits while another home modal blocks it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Required)

    const { result, rerender } = renderHook(
      ({ isBlocked }: { isBlocked: boolean }) => useTwoFactorSessionPrompt({ isBlocked }),
      { initialProps: { isBlocked: true } },
    )

    expect(mockConsumeSessionStart).not.toHaveBeenCalled()
    expect(result.current.isModalOpen).toBe(false)

    rerender({ isBlocked: false })

    expect(result.current.isModalOpen).toBe(true)
    expect(mockConsumeSessionStart).toHaveBeenCalledTimes(1)
  })

  it("closes the modal on request", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Required)
    const { result } = renderPrompt()

    act(() => result.current.closeModal())

    expect(result.current.isModalOpen).toBe(false)
  })

  it("closes the modal on its own once the account no longer needs it", () => {
    sessionStartOwing(TwoFactorSessionPrompt.RequiredModal, TwoFactorTier.Required)
    const { result, rerender } = renderPrompt()
    expect(result.current.isModalOpen).toBe(true)

    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None
    rerender({})

    expect(result.current.isModalOpen).toBe(false)
  })
})
