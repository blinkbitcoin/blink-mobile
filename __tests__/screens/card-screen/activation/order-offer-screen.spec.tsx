import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import { CardActivationStep } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CardOrderOfferScreen } from "@app/screens/card-screen/activation/order-offer-screen"

import { ContextForScreen } from "../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

type CardFixture = { id: string; lastFour: string; status: string }
const virtualCard: CardFixture = {
  id: "card-virtual",
  lastFour: "2121",
  status: "ACTIVE",
}
let mockCard: CardFixture | undefined = virtualCard
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => ({ card: mockCard, hasPhysicalCard: false, loading: false }),
}))

const mockMoveOn = jest.fn()
const mockUseCardActivation = jest.fn()
jest.mock("@app/hooks/use-card-activation", () => ({
  useCardActivation: (options: Record<string, unknown>) => {
    mockUseCardActivation(options)
    return { moveOn: mockMoveOn }
  },
}))

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardOrderOfferScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardOrderOfferScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockCard = virtualCard
  })

  it("stands for the activation's offer of the other way", async () => {
    await renderScreen()

    expect(mockUseCardActivation).toHaveBeenCalledWith({
      step: CardActivationStep.OfferOtherWay,
    })
  })

  it("offers the physical card, delivered anywhere", async () => {
    const { getAllByText, getByText } = await renderScreen()

    expect(getAllByText("Order physical card")).toHaveLength(2)
    expect(
      getByText("Get your Blink Card delivered to any address of your choosing."),
    ).toBeTruthy()
  })

  it("opens the physical card order", async () => {
    const { getAllByText } = await renderScreen()
    const [, orderButton] = getAllByText("Order physical card")

    await act(async () => {
      fireEvent.press(orderButton)
    })

    expect(mockNavigate).toHaveBeenCalledWith("orderCardScreen")
  })

  it("moves the activation on when the member skips for now", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Skip for now"))
    })

    expect(mockMoveOn).toHaveBeenCalledWith(CardActivationStep.OfferOtherWay)
  })

  it("still offers the order while the card is loading", async () => {
    mockCard = undefined
    const { getByText } = await renderScreen()

    expect(getByText("Skip for now")).toBeTruthy()
  })

  it("offers no wallet, since the member took it first", async () => {
    const { queryByLabelText } = await renderScreen()

    expect(queryByLabelText("Add to Apple Wallet")).toBeNull()
    expect(queryByLabelText("Add to Google Pay")).toBeNull()
  })
})
