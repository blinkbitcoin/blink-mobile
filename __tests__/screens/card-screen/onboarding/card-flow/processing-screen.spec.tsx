import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardApprovalWait } from "@app/screens/card-screen/onboarding/card-flow/use-card-application-approval"
import { CardProcessingScreen } from "@app/screens/card-screen/onboarding/card-flow/processing-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()
const mockPopTo = jest.fn()
const mockReplace = jest.fn()
const mockUseApproval = jest.fn()
const mockUseDashedLineFlow = jest.fn()

jest.mock("@app/components/animations", () => ({
  useDashedLineFlow: (params: unknown) => {
    mockUseDashedLineFlow(params)
    return { animatedProps: {}, dashArray: "5 5" }
  },
}))

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      popTo: mockPopTo,
      replace: mockReplace,
    }),
    useRoute: () => ({ params: { applicationId: "application-1" } }),
  }
})

jest.mock(
  "@app/screens/card-screen/onboarding/card-flow/use-card-application-approval",
  () => ({
    useCardApplicationApproval: (applicationId: string) => mockUseApproval(applicationId),
  }),
)

const renderScreen = async (approvalWait: CardApprovalWait) => {
  mockUseApproval.mockReturnValue(approvalWait)
  const screen = render(
    <ContextForScreen>
      <CardProcessingScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardProcessingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("says the application is being processed and how long it can take", async () => {
    const { getByText } = await renderScreen("waiting")

    expect(getByText("Processing your application")).toBeTruthy()
    expect(getByText("This can take up to a minute")).toBeTruthy()
  })

  it("flows the line's dashes, as long as the gaps, toward the card", async () => {
    await renderScreen("waiting")

    expect(mockUseDashedLineFlow).toHaveBeenCalledWith({
      dashLength: 89 / 18,
      gapLength: 89 / 18,
    })
  })

  it("offers no button while it waits", async () => {
    const { queryByRole } = await renderScreen("waiting")

    expect(queryByRole("button")).toBeNull()
  })

  it("follows the application it was handed", async () => {
    await renderScreen("waiting")

    expect(mockUseApproval).toHaveBeenCalledWith("application-1")
  })

  it("stays put while the issuer has not answered", async () => {
    await renderScreen("waiting")

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("celebrates an approval on the approved screen, in its place", async () => {
    await renderScreen("approved")

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingPreapprovedScreen")
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("breaks a refusal on the declined screen, in its place", async () => {
    await renderScreen("declined")

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingDeclinedScreen")
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  /** Navigating there would stack a second Home over this screen, which would stay
   *  frozen underneath it. */
  it("goes back to the Home under it when the minute is up without an answer", async () => {
    await renderScreen("timedOut")

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
