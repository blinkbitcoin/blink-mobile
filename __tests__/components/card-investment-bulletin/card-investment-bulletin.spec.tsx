import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { CardInvestmentBulletin } from "@app/components/card-investment-bulletin"
import { CardInvestmentBulletinKind } from "@app/types/card-investment"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
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

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { continue: () => "Continue", convert: () => "Convert" },
      CardFlow: {
        Onboarding: {
          InsufficientBalance: {
            buttonText: () => "Deposit",
            splitFunds: {
              title: () => "Your funds are split",
              body: () => "Convert so the full amount sits in one of them.",
            },
          },
          HomeBulletin: {
            insufficient: {
              title: () => "Insufficient balance",
              body: () => "To complete your investment, deposit the remaining amount.",
            },
            depositPending: {
              title: () => "Hold on",
              body: () => "We are waiting for your deposit to settle.",
            },
            ready: {
              title: () => "Complete your investment",
              body: () => "You now have enough funds to complete the investment.",
            },
            shareholder: {
              title: () => "Welcome as Blink shareholder!",
              body: () =>
                "We will let you know as soon as your Blink Visa Card is ready.",
            },
          },
        },
      },
    },
  }),
}))

const PROGRESS = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: 1_757_700_000_000,
}

const renderBulletin = (kind: CardInvestmentBulletinKind, onDismiss = jest.fn()) =>
  render(<CardInvestmentBulletin kind={kind} progress={PROGRESS} onDismiss={onDismiss} />)

describe("CardInvestmentBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("insufficient balance", () => {
    it("asks for the money with a Deposit button", () => {
      const { getByText, getByTestId, queryByTestId } = renderBulletin(
        CardInvestmentBulletinKind.Insufficient,
      )

      expect(getByText("Insufficient balance")).toBeTruthy()
      expect(
        getByText("To complete your investment, deposit the remaining amount."),
      ).toBeTruthy()
      expect(getByTestId("cta-button")).toBeTruthy()
      expect(getByText("Deposit")).toBeTruthy()
      expect(queryByTestId("dismiss-button")).toBeNull()
    })

    /** The shortfall screen already decides between depositing and converting, for the
     *  amount the investor chose; the card opens it rather than restating that choice. */
    it("opens the shortfall step for the signed amount", async () => {
      const { getByTestId } = renderBulletin(CardInvestmentBulletinKind.Insufficient)

      await act(async () => {
        fireEvent.press(getByTestId("cta-button"))
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        "cardOnboardingInsufficientBalanceScreen",
        {
          selectedAmountUsd: PROGRESS.selectedAmountUsd,
        },
      )
    })
  })

  describe("split funds", () => {
    /** The money is there, spread over both wallets: asking for a deposit would ask for
     *  money the investor already holds, so the card asks them to convert instead. */
    it("asks the investor to convert, with a Convert button", () => {
      const { getByText, getByTestId, queryByTestId } = renderBulletin(
        CardInvestmentBulletinKind.SplitFunds,
      )

      expect(getByText("Your funds are split")).toBeTruthy()
      expect(getByText("Convert so the full amount sits in one of them.")).toBeTruthy()
      expect(getByTestId("cta-button")).toBeTruthy()
      expect(getByText("Convert")).toBeTruthy()
      expect(queryByTestId("dismiss-button")).toBeNull()
    })

    it("opens the same shortfall step, which offers the conversion", async () => {
      const { getByTestId } = renderBulletin(CardInvestmentBulletinKind.SplitFunds)

      await act(async () => {
        fireEvent.press(getByTestId("cta-button"))
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        "cardOnboardingInsufficientBalanceScreen",
        {
          selectedAmountUsd: PROGRESS.selectedAmountUsd,
        },
      )
    })
  })

  describe("deposit pending", () => {
    it("asks the investor to wait, with nothing to press but the card", () => {
      const { getByText, queryByTestId } = renderBulletin(
        CardInvestmentBulletinKind.DepositPending,
      )

      expect(getByText("Hold on")).toBeTruthy()
      expect(getByText("We are waiting for your deposit to settle.")).toBeTruthy()
      expect(queryByTestId("cta-button")).toBeNull()
      expect(queryByTestId("dismiss-button")).toBeNull()
    })

    it("opens the deposit-pending step when the card is tapped", async () => {
      const { getByText } = renderBulletin(CardInvestmentBulletinKind.DepositPending)

      await act(async () => {
        fireEvent.press(getByText("Hold on"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingDepositPendingScreen")
    })
  })

  describe("ready to pay", () => {
    it("sends the investor back to pay with a Continue button", () => {
      const { getByText, getByTestId, queryByTestId } = renderBulletin(
        CardInvestmentBulletinKind.Ready,
      )

      expect(getByText("Complete your investment")).toBeTruthy()
      expect(
        getByText("You now have enough funds to complete the investment."),
      ).toBeTruthy()
      expect(getByTestId("cta-button")).toBeTruthy()
      expect(getByText("Continue")).toBeTruthy()
      expect(queryByTestId("dismiss-button")).toBeNull()
    })

    /** The transfer step bills the satoshis the agreement names, so it gets them back
     *  along with the amount, exactly as the signing step hands them over. */
    it("opens the transfer step with what the signing step recorded", async () => {
      const { getByTestId } = renderBulletin(CardInvestmentBulletinKind.Ready)

      await act(async () => {
        fireEvent.press(getByTestId("cta-button"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen", {
        selectedAmountUsd: PROGRESS.selectedAmountUsd,
        settlementSats: PROGRESS.settlementSats,
      })
    })
  })

  describe("shareholder", () => {
    it("welcomes the investor with only a close control", () => {
      const { getByText, getByTestId, queryByTestId } = renderBulletin(
        CardInvestmentBulletinKind.Shareholder,
      )

      expect(getByText("Welcome as Blink shareholder!")).toBeTruthy()
      expect(
        getByText("We will let you know as soon as your Blink Visa Card is ready."),
      ).toBeTruthy()
      expect(getByTestId("dismiss-button")).toBeTruthy()
      expect(queryByTestId("cta-button")).toBeNull()
    })

    it("dismisses from the close control", () => {
      const onDismiss = jest.fn()
      const { getByTestId } = renderBulletin(
        CardInvestmentBulletinKind.Shareholder,
        onDismiss,
      )

      fireEvent.press(getByTestId("dismiss-button"))

      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it("goes nowhere when the card itself is tapped", () => {
      const { getByText } = renderBulletin(CardInvestmentBulletinKind.Shareholder)

      fireEvent.press(getByText("Welcome as Blink shareholder!"))

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
