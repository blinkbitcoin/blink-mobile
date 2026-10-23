import { act, renderHook } from "@testing-library/react-native"

import { useContactChange } from "@app/custodial/hooks/use-contact-change"
import { ContactChangeStep, ContactField } from "@app/types/two-factor-enforcement"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockLogStarted = jest.fn()
const mockLogNeeds2faShown = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logContactChangeStarted: (...args: unknown[]) => mockLogStarted(...args),
  logContactChangeNeeds2faShown: (...args: unknown[]) => mockLogNeeds2faShown(...args),
}))

describe("useContactChange", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("goes to the code that removes the email on an account with an authenticator", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Email, true))

    act(() => result.current.startChange())

    expect(mockLogStarted).toHaveBeenCalledWith({
      field: ContactField.Email,
      hasAuthenticator: true,
    })
    expect(mockNavigate).toHaveBeenCalledWith("contactChangeCode", {
      step: ContactChangeStep.EmailRemove,
    })
    expect(result.current.isNeedsAuthenticatorVisible).toBe(false)
    expect(mockLogNeeds2faShown).not.toHaveBeenCalled()
  })

  it("goes to the code that removes the phone number for the phone row", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Phone, true))

    act(() => result.current.startChange())

    expect(mockNavigate).toHaveBeenCalledWith("contactChangeCode", {
      step: ContactChangeStep.PhoneRemove,
    })
  })

  it("asks for an authenticator first on an account without one", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Phone, false))

    act(() => result.current.startChange())

    expect(mockLogStarted).toHaveBeenCalledWith({
      field: ContactField.Phone,
      hasAuthenticator: false,
    })
    expect(mockLogNeeds2faShown).toHaveBeenCalledWith({ field: ContactField.Phone })
    expect(result.current.isNeedsAuthenticatorVisible).toBe(true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("changes nothing when the modal is closed", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Email, false))
    act(() => result.current.startChange())

    act(() => result.current.closeNeedsAuthenticator())
    act(() => result.current.openRequestedOnboarding())

    expect(result.current.isNeedsAuthenticatorVisible).toBe(false)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** Pushed while the modal still closes, the onboarding can hang the transition. */
  it("opens the onboarding for the change only once the modal is off the screen", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Email, false))
    act(() => result.current.startChange())

    act(() => result.current.setAuthenticator())

    expect(result.current.isNeedsAuthenticatorVisible).toBe(false)
    expect(mockNavigate).not.toHaveBeenCalled()

    act(() => result.current.openRequestedOnboarding())

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationIntro", {
      contactChange: ContactField.Email,
    })
  })

  it("opens the onboarding once for one request", () => {
    const { result } = renderHook(() => useContactChange(ContactField.Phone, false))
    act(() => result.current.startChange())
    act(() => result.current.setAuthenticator())

    act(() => result.current.openRequestedOnboarding())
    act(() => result.current.openRequestedOnboarding())

    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })
})
