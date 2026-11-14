import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardVerifyIdentityScreen } from "@app/screens/card-screen/onboarding/card-flow/card-verify-identity-screen"
import { ContextForScreen } from "../../../helper"

const mockStartKyc = jest.fn()
const mockUseKycFlow = jest.fn()

jest.mock("@app/hooks", () => ({
  useKycFlow: (params: unknown) => {
    mockUseKycFlow(params)
    return { startKyc: mockStartKyc }
  },
}))

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
})
