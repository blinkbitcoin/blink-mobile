import React from "react"
import { it } from "@jest/globals"
import { act, fireEvent, render } from "@testing-library/react-native"

import { CardActivationStep } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CardWalletOfferScreen } from "@app/screens/card-screen/activation/wallet-offer-screen"
import { WalletAddResult } from "@app/screens/card-screen/types"

import { ContextForScreen } from "../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

type CardFixture = { id: string; lastFour: string; status: string }
const physicalCard: CardFixture = {
  id: "card-physical",
  lastFour: "4242",
  status: "ACTIVE",
}
let mockCard: CardFixture | undefined = physicalCard
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => ({ card: mockCard, hasPhysicalCard: true, loading: false }),
}))

const mockMoveOn = jest.fn()
const mockUseCardActivation = jest.fn()
let mockIsPending = true
jest.mock("@app/hooks/use-card-activation", () => ({
  useCardActivation: (options: Record<string, unknown>) => {
    mockUseCardActivation(options)
    /** A new function on every draw, as the hook's own changes whenever the facts do. */
    return {
      isPending: mockIsPending,
      moveOn: (...args: readonly unknown[]) => mockMoveOn(...args),
    }
  },
}))

type WalletState = {
  canAddToWallet: boolean
  isWalletUnavailable: boolean
  isAdding: boolean
}
const walletReady: WalletState = {
  canAddToWallet: true,
  isWalletUnavailable: false,
  isAdding: false,
}
let mockWallet: WalletState = walletReady
const mockAddToWallet = jest.fn()
const mockUseAddToWallet = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-add-to-wallet", () => ({
  useAddToWallet: (cardId?: string, lastFour?: string) => {
    mockUseAddToWallet(cardId, lastFour)
    return { ...mockWallet, addToWallet: mockAddToWallet }
  },
}))

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardWalletOfferScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardWalletOfferScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockCard = physicalCard
    mockIsPending = true
    mockWallet = walletReady
  })

  it("stands for the activation's offer of the other way", async () => {
    await renderScreen()

    expect(mockUseCardActivation).toHaveBeenCalledWith({
      step: CardActivationStep.OfferOtherWay,
    })
  })

  it("offers the card the app shows to the wallet", async () => {
    const { getByText, getByLabelText } = await renderScreen()

    expect(mockUseAddToWallet).toHaveBeenCalledWith("card-physical", "4242")
    expect(getByText("Add your card")).toBeTruthy()
    expect(
      getByText(i18nObject("en").CardFlow.AddToMobileWallet.addYourCardDescription()),
    ).toBeTruthy()
    expect(getByLabelText("Add to Apple Wallet")).toBeTruthy()
  })

  it("goes on once the wallet takes the card", async () => {
    mockAddToWallet.mockResolvedValue(WalletAddResult.Added)
    const { getByLabelText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByLabelText("Add to Apple Wallet"))
    })

    expect(mockMoveOn).toHaveBeenCalledWith(CardActivationStep.OfferOtherWay, {
      isWalletAdded: true,
    })
  })

  it.each([WalletAddResult.Cancelled, WalletAddResult.Busy, undefined])(
    "stays when the wallet does not take the card (%s)",
    async (walletAnswer) => {
      mockAddToWallet.mockResolvedValue(walletAnswer)
      const { getByLabelText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByLabelText("Add to Apple Wallet"))
      })

      expect(mockMoveOn).not.toHaveBeenCalled()
    },
  )

  it("moves the activation on when the member skips for now", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Skip for now"))
    })

    expect(mockMoveOn).toHaveBeenCalledWith(CardActivationStep.OfferOtherWay)
  })

  describe("a phone whose wallet cannot take the card", () => {
    beforeEach(() => {
      mockWallet = { canAddToWallet: false, isWalletUnavailable: true, isAdding: false }
    })

    it("passes over the offer, as if the member skipped it", async () => {
      await renderScreen()

      expect(mockMoveOn).toHaveBeenCalledTimes(1)
      expect(mockMoveOn).toHaveBeenCalledWith(CardActivationStep.OfferOtherWay)
    })

    it("passes over once, however often the screen draws", async () => {
      const screen = await renderScreen()

      screen.rerender(
        <ContextForScreen>
          <CardWalletOfferScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(mockMoveOn).toHaveBeenCalledTimes(1)
    })

    it("waits for the activation before passing over", async () => {
      mockIsPending = false

      await renderScreen()

      expect(mockMoveOn).not.toHaveBeenCalled()
    })
  })

  it("keeps the offer while the wallet is still checking", async () => {
    mockWallet = { canAddToWallet: false, isWalletUnavailable: false, isAdding: false }

    const { getByText, queryByLabelText } = await renderScreen()

    expect(mockMoveOn).not.toHaveBeenCalled()
    expect(queryByLabelText("Add to Apple Wallet")).toBeNull()
    expect(getByText("Skip for now")).toBeTruthy()
  })

  it("draws no frozen card while the card is still loading", async () => {
    mockCard = undefined

    const { getByText } = await renderScreen()

    expect(mockUseAddToWallet).toHaveBeenCalledWith(undefined, undefined)
    expect(getByText("Skip for now")).toBeTruthy()
  })
})
