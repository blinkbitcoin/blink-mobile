import React from "react"
import { it } from "@jest/globals"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardActivationStep } from "@app/graphql/generated"
import { CardApprovedScreen } from "@app/screens/card-screen/onboarding/approved-screen"
import { WalletAddResult } from "@app/screens/card-screen/types"
import { ContextForScreen } from "../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

type LayoutProps = {
  title: string
  subtitle: string
  buttonLabel: string
  onPrimaryButtonPress: () => void
  secondaryButtonLabel?: string
  onSecondaryButtonPress?: () => void
  cardId?: string
  cardNumber?: string
  showAddToWallet?: boolean
  onAddToWallet: () => Promise<void> | void
  isAddingToWallet?: boolean
}

const mockLayoutProps = jest.fn()
jest.mock("@app/components/card-screen", () => {
  const { View, Text, TouchableOpacity } = jest.requireActual("react-native")
  return {
    CardStatusLayout: (props: LayoutProps) => {
      mockLayoutProps(props)
      return (
        <View>
          <Text>{props.title}</Text>
          <Text>{props.subtitle}</Text>
          <TouchableOpacity onPress={props.onPrimaryButtonPress}>
            <Text>{props.buttonLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={props.onSecondaryButtonPress}>
            <Text>{props.secondaryButtonLabel}</Text>
          </TouchableOpacity>
        </View>
      )
    },
  }
})

const mockAddToWallet = jest.fn()
const mockUseAddToWallet = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-add-to-wallet", () => ({
  useAddToWallet: (cardId?: string, lastFour?: string) =>
    mockUseAddToWallet(cardId, lastFour),
}))

const lastLayoutProps = (): LayoutProps =>
  mockLayoutProps.mock.calls[mockLayoutProps.mock.calls.length - 1][0]

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

const mockRedirect = jest.fn()
const mockMoveOn = jest.fn()
let mockIsActivationComplete = false
const mockUseCardActivation = jest.fn()
jest.mock("@app/hooks/use-card-activation", () => ({
  useCardActivation: (options: Record<string, unknown>) => {
    mockUseCardActivation(options)
    return {
      isComplete: mockIsActivationComplete,
      redirect: mockRedirect,
      moveOn: mockMoveOn,
    }
  },
}))

let mockHasPhysicalCard = false
let mockCardLastFour: string | undefined = "1234"

jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => ({
    card: mockCardLastFour ? { id: "card-123", lastFour: mockCardLastFour } : null,
    hasPhysicalCard: mockHasPhysicalCard,
    loading: false,
  }),
}))

describe("CardApprovedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockHasPhysicalCard = false
    mockIsActivationComplete = false
    mockCardLastFour = "1234"
    mockUseAddToWallet.mockReturnValue({
      canAddToWallet: true,
      isAdding: false,
      addToWallet: mockAddToWallet,
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("passes correct title to layout", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Congratulations!")).toBeTruthy()
  })

  it("passes correct subtitle to layout", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Your Blink Visa Card has been activated.")).toBeTruthy()
  })

  it("stands for the first step of the card activation", async () => {
    render(
      <ContextForScreen>
        <CardApprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(mockUseCardActivation).toHaveBeenCalledWith({
      step: CardActivationStep.Activated,
    })
  })

  describe("without physical card", () => {
    it("shows Order physical card button label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Order physical card")).toBeTruthy()
    })

    it("navigates to orderCardScreen on button press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Order physical card"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("orderCardScreen")
    })

    it("offers no way past without the physical card or the wallet", async () => {
      const { queryByText } = render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Skip for now")).toBeNull()
      expect(lastLayoutProps().secondaryButtonLabel).toBeUndefined()
    })

    it("stays while no way has been taken yet", async () => {
      render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  describe("once a way has been taken", () => {
    it("sends a member with a physical card on, rather than offering a second order", async () => {
      mockHasPhysicalCard = true

      render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockRedirect).toHaveBeenCalledTimes(1)
    })

    it("sends a member whose activation is done on", async () => {
      mockIsActivationComplete = true

      render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockRedirect).toHaveBeenCalledTimes(1)
    })
  })

  describe("add to wallet", () => {
    const renderScreen = async () => {
      render(
        <ContextForScreen>
          <CardApprovedScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
    }

    it("checks the wallet with the approved card", async () => {
      await renderScreen()

      expect(mockUseAddToWallet).toHaveBeenCalledWith("card-123", "1234")
    })

    it("hands the card and the wallet state to the layout", async () => {
      await renderScreen()

      expect(lastLayoutProps()).toEqual(
        expect.objectContaining({
          cardId: "card-123",
          cardNumber: "1234",
          showAddToWallet: true,
          onAddToWallet: expect.any(Function),
          isAddingToWallet: false,
        }),
      )
    })

    it("draws no frozen card while the card is still loading", async () => {
      mockCardLastFour = undefined

      await renderScreen()

      expect(lastLayoutProps()).toEqual(
        expect.objectContaining({ cardId: undefined, isFrozen: false }),
      )
    })

    it("goes on to the PIN once the wallet takes the card", async () => {
      mockAddToWallet.mockResolvedValue(WalletAddResult.Added)
      await renderScreen()

      await act(async () => {
        await lastLayoutProps().onAddToWallet()
      })

      expect(mockAddToWallet).toHaveBeenCalledTimes(1)
      expect(mockMoveOn).toHaveBeenCalledWith(CardActivationStep.Activated, {
        isWalletAdded: true,
      })
    })

    it.each([WalletAddResult.Cancelled, WalletAddResult.Busy, undefined])(
      "stays when the wallet does not take the card (%s)",
      async (walletAnswer) => {
        mockAddToWallet.mockResolvedValue(walletAnswer)
        await renderScreen()

        await act(async () => {
          await lastLayoutProps().onAddToWallet()
        })

        expect(mockMoveOn).not.toHaveBeenCalled()
      },
    )

    it("hides the add to wallet button when the wallet cannot take the card", async () => {
      mockUseAddToWallet.mockReturnValue({
        canAddToWallet: false,
        isAdding: false,
        addToWallet: mockAddToWallet,
      })

      await renderScreen()

      expect(lastLayoutProps().showAddToWallet).toBe(false)
    })
  })
})
