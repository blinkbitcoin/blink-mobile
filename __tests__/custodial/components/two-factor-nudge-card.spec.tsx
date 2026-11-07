import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { BulletinCarouselItemContext } from "@app/components/notifications/bulletin-carousel-context"
import { TwoFactorNudgeCard } from "@app/custodial/components/two-factor-nudge-card"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#007",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "dismiss-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "cta-button" },
      React.createElement("Text", {}, title),
    ),
}))

const mockMarkPromptShown = jest.fn()
const mockDismissNudgeCard = jest.fn()
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({
    markPromptShown: mockMarkPromptShown,
    dismissNudgeCard: mockDismissNudgeCard,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      TwoFactorEnforcement: {
        title: () => "Set two-factor authentication",
        cardDescription: () => "Protect your account from unauthorized access.",
        cardCta: () => "Set",
      },
    },
  }),
}))

describe("TwoFactorNudgeCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the title, body and Set button", () => {
    const { getByText } = render(<TwoFactorNudgeCard />)

    expect(getByText("Set two-factor authentication")).toBeTruthy()
    expect(getByText("Protect your account from unauthorized access.")).toBeTruthy()
    expect(getByText("Set")).toBeTruthy()
  })

  it("reports itself as shown to the enforcement, which counts the impressions", () => {
    render(<TwoFactorNudgeCard />)

    expect(mockMarkPromptShown).toHaveBeenCalledTimes(1)
    /** The nudge has no reason to report: only the reminder bulletin carries one. */
    expect(mockMarkPromptShown).toHaveBeenCalledWith("home_card", undefined)
  })

  /** The carousel mounts the cards out of view too: one behind another card is not
   *  shown until the user swipes to it. */
  it("reports itself as shown only once it is the carousel's card in view", () => {
    const inCarousel = (isActive: boolean) => (
      <BulletinCarouselItemContext.Provider value={{ isActive }}>
        <TwoFactorNudgeCard />
      </BulletinCarouselItemContext.Provider>
    )
    const { rerender } = render(inCarousel(false))

    expect(mockMarkPromptShown).not.toHaveBeenCalled()

    rerender(inCarousel(true))

    expect(mockMarkPromptShown).toHaveBeenCalledTimes(1)
    expect(mockMarkPromptShown).toHaveBeenCalledWith("home_card", undefined)
  })

  it("opens the setup from Set, telling it the card opened it", () => {
    const { getByTestId } = render(<TwoFactorNudgeCard />)

    fireEvent.press(getByTestId("cta-button"))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup", {
      origin: { prompt: "home_card", reason: undefined },
    })
  })

  it("hands the X to the enforcement's dismissal", () => {
    const { getByTestId } = render(<TwoFactorNudgeCard />)

    fireEvent.press(getByTestId("dismiss-button"))

    expect(mockDismissNudgeCard).toHaveBeenCalledTimes(1)
  })
})
