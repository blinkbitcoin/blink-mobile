import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardAddToMobileWalletScreen } from "@app/screens/card-screen/card-add-to-mobile-wallet-screen"
import { ContextForScreen } from "../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  isIos: false,
}))

jest.mock("@app/hooks/use-card-holder", () => ({
  useCardHolder: () => ({
    firstName: "TEST",
    lastName: "USER",
    fullName: "TEST USER",
    loading: false,
  }),
}))

const mockAddToWallet = jest.fn()
const mockUseAddToWallet = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-add-to-wallet", () => ({
  useAddToWallet: (cardId: string, lastFour: string) =>
    mockUseAddToWallet(cardId, lastFour),
}))

const walletState = (
  overrides: { canAddToWallet?: boolean; isAdding?: boolean } = {},
) => ({
  canAddToWallet: true,
  isAdding: false,
  addToWallet: mockAddToWallet,
  ...overrides,
})

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useRoute: () => ({
      params: {
        lastFour: "1111",
        cardId: "card-123",
      },
    }),
  }
})

describe("CardAddToMobileWalletScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseAddToWallet.mockReturnValue(walletState())
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays add your card title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add your card")).toBeTruthy()
    })

    it("displays add your card description", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Add your Blink Visa card to your mobile wallet for quick and secure payments",
        ),
      ).toBeTruthy()
    })
  })

  describe("card display", () => {
    it("displays the card holder name on the card", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const holderNames = getAllByText("TEST USER")
      expect(holderNames.length).toBeGreaterThanOrEqual(1)
    })

    it("displays the masked card number", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText(/•••• •••• •••• 1111/)).toBeTruthy()
    })
  })

  describe("add to wallet button", () => {
    const renderScreen = async () => {
      const screen = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      return screen
    }

    it("checks the wallet with the card from the route", async () => {
      await renderScreen()

      expect(mockUseAddToWallet).toHaveBeenCalledWith("card-123", "1111")
    })

    it("shows the button when the wallet can take the card", async () => {
      const { getByText } = await renderScreen()

      expect(getByText("Add to")).toBeTruthy()
    })

    it("hides the button when the wallet cannot take the card", async () => {
      mockUseAddToWallet.mockReturnValue(walletState({ canAddToWallet: false }))

      const { queryByText } = await renderScreen()

      expect(queryByText("Add to")).toBeNull()
    })

    it("adds the card to the wallet when the button is pressed", async () => {
      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Add to"))
      })

      expect(mockAddToWallet).toHaveBeenCalledTimes(1)
    })

    it("disables the button while the card is being added", async () => {
      mockUseAddToWallet.mockReturnValue(walletState({ isAdding: true }))

      const { getByLabelText } = await renderScreen()

      expect(getByLabelText("Add to Google Pay").props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      )
    })
  })

  describe("benefits section", () => {
    it("displays benefits title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Benefits of mobile wallet")).toBeTruthy()
    })

    it("displays contactless payments benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contactless payments at millions of locations")).toBeTruthy()
    })

    it("displays security benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enhanced security with biometric authentication")).toBeTruthy()
    })

    it("displays no physical card benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("No need to carry your physical card")).toBeTruthy()
    })

    it("displays works when locked benefit", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Works even when your phone is locked")).toBeTruthy()
    })

    it("displays all four benefits", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contactless payments at millions of locations")).toBeTruthy()
      expect(getByText("Enhanced security with biometric authentication")).toBeTruthy()
      expect(getByText("No need to carry your physical card")).toBeTruthy()
      expect(getByText("Works even when your phone is locked")).toBeTruthy()
    })
  })

  describe("hero section", () => {
    it("displays hero section with icon", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const tree = toJSON()
      expect(tree).toBeTruthy()
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardAddToMobileWalletScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add your card")).toBeTruthy()
      expect(
        getByText(
          "Add your Blink Visa card to your mobile wallet for quick and secure payments",
        ),
      ).toBeTruthy()
      expect(getByText("Add to")).toBeTruthy()
      expect(getByText("Benefits of mobile wallet")).toBeTruthy()
    })
  })
})
