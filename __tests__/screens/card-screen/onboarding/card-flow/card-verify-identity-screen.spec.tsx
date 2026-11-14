import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardVerifyIdentityScreen } from "@app/screens/card-screen/onboarding/card-flow/card-verify-identity-screen"
import { ContextForScreen } from "../../../helper"

const mockStartKyc = jest.fn()
const mockUseKycFlow = jest.fn()
const mockReadKycStatus = jest.fn()
const mockReplace = jest.fn()
const mockIsFocused = jest.fn()
const mockKycStatus = { isKycSubmitted: false, isCheckingKyc: false }

jest.mock("@app/hooks", () => ({
  useKycFlow: (params: unknown) => {
    mockUseKycFlow(params)
    return { startKyc: mockStartKyc, loading: false }
  },
}))

jest.mock("@app/screens/card-screen/onboarding/card-flow/use-card-kyc-status", () => ({
  useCardKycStatus: () => ({ readKycStatus: mockReadKycStatus, ...mockKycStatus }),
}))

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  const { useEffect } = jest.requireActual("react")
  return {
    ...actualNav,
    useNavigation: () => ({ replace: mockReplace }),
    useIsFocused: () => mockIsFocused(),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  }
})

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardVerifyIdentityScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardVerifyIdentityScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsFocused.mockReturnValue(true)
    mockKycStatus.isKycSubmitted = false
    mockKycStatus.isCheckingKyc = false
  })

  it("explains that the card issuer has to verify who the user is", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Verify your identity")).toBeTruthy()
    expect(
      getByText(
        "To activate your Blink Card, the card issuer must verify who you are (KYC). You will need:",
      ),
    ).toBeTruthy()
  })

  it("lists what the verification asks for", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("A government-issued ID")).toBeTruthy()
    expect(getByText("A selfie / liveness check")).toBeTruthy()
    expect(getByText("Proof of address")).toBeTruthy()
    expect(getByText("A few questions about you")).toBeTruthy()
  })

  it("prepares the card verification", async () => {
    await renderScreen()

    expect(mockUseKycFlow).toHaveBeenCalledWith({
      type: "CARD",
      headerTitle: "Verification",
    })
  })

  it("starts the verification on Continue", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockStartKyc).toHaveBeenCalledTimes(1)
  })

  it("reads the issuer's review whenever the step is in view", async () => {
    await renderScreen()

    expect(mockReadKycStatus).toHaveBeenCalledTimes(1)
  })

  it("moves on to the additional data once the card verification is submitted", async () => {
    mockKycStatus.isKycSubmitted = true

    await renderScreen()

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingPersonalInfoScreen")
  })

  it("stays on the step while the verification is not submitted", async () => {
    await renderScreen()

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("leaves the stack alone while the step is out of view", async () => {
    mockKycStatus.isKycSubmitted = true
    mockIsFocused.mockReturnValue(false)

    await renderScreen()

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("holds Continue on its spinner while the review is being read", async () => {
    mockKycStatus.isCheckingKyc = true
    const { queryByText } = await renderScreen()

    expect(queryByText("Continue")).toBeNull()
  })
})
