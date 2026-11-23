import { it } from "@jest/globals"
import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CHIP_GLYPH_SIZE } from "@app/components/busy-state"
import { CardApprovalWait } from "@app/screens/card-screen/onboarding/card-flow/use-card-application-approval"
import { CardProcessingScreen } from "@app/screens/card-screen/onboarding/card-flow/processing-screen"
import { ContextForScreen } from "../../../helper"

type BusyStateProps = {
  icon1: React.ReactElement<{ name: string; size: number }>
  icon2: React.ReactElement<{ name: string; size: number }>
  title: string
  body?: string
  completion: { kind: string; done?: boolean }
  onDone: () => void
}

const mockNavigate = jest.fn()
const mockPopTo = jest.fn()
const mockReplace = jest.fn()
const mockUseApproval = jest.fn()
const mockBusyStateScreen = jest.fn()

/** The busy screen's own timing and back handling are covered by its spec; here only what
 *  the card flow hands it, and where it goes once the screen reports it is done. */
jest.mock("@app/components/busy-state", () => {
  const actual = jest.requireActual("@app/components/busy-state")
  const { Text, View } = jest.requireActual("react-native")
  return {
    ...actual,
    BusyStateScreen: (props: BusyStateProps) => {
      mockBusyStateScreen(props)
      return (
        <View>
          <Text>{props.title}</Text>
          <Text>{props.body}</Text>
        </View>
      )
    },
  }
})

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

const lastBusyStateProps = (): BusyStateProps =>
  mockBusyStateScreen.mock.calls[mockBusyStateScreen.mock.calls.length - 1][0]

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

  it("shows the clock leading to the card, at the busy screen's glyph size", async () => {
    await renderScreen("waiting")

    const { icon1, icon2 } = lastBusyStateProps()
    expect(icon1.props).toMatchObject({ name: "clock", size: CHIP_GLYPH_SIZE })
    expect(icon2.props).toMatchObject({ name: "card", size: CHIP_GLYPH_SIZE })
  })

  it("follows the application it was handed", async () => {
    await renderScreen("waiting")

    expect(mockUseApproval).toHaveBeenCalledWith("application-1")
  })

  it("keeps the busy screen going while the issuer has not answered", async () => {
    await renderScreen("waiting")

    expect(lastBusyStateProps().completion).toEqual({ kind: "pending", done: false })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it.each<CardApprovalWait>(["approved", "declined", "timedOut"])(
    "ends the busy screen once the wait is over (%s)",
    async (approvalWait) => {
      await renderScreen(approvalWait)

      expect(lastBusyStateProps().completion).toEqual({ kind: "pending", done: true })
    },
  )

  it("leaves the screen only when the busy screen reports it is done", async () => {
    await renderScreen("approved")

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("celebrates an approval on the approved screen, in its place", async () => {
    await renderScreen("approved")

    act(() => lastBusyStateProps().onDone())

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingPreapprovedScreen")
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("breaks a refusal on the declined screen, in its place", async () => {
    await renderScreen("declined")

    act(() => lastBusyStateProps().onDone())

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingDeclinedScreen")
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  /** Navigating there would stack a second Home over this screen, which would stay
   *  frozen underneath it. */
  it("goes back to the Home under it when the minute is up without an answer", async () => {
    await renderScreen("timedOut")

    act(() => lastBusyStateProps().onDone())

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
