import { renderHook } from "@testing-library/react-native"

import { CardStatus } from "@app/graphql/generated"
import { useTransferCard } from "@app/screens/conversion-flow/hooks/use-transfer-card"

const mockIsCardBackendAvailable = jest.fn()
jest.mock("@app/hooks/use-is-card-backend-available", () => ({
  useIsCardBackendAvailable: () => mockIsCardBackendAvailable(),
}))

const mockUseActiveWallet = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

const mockUseCardData = jest.fn()
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: (options: { skip: boolean }) => mockUseCardData(options),
}))

const mockUseCardBalance = jest.fn()
jest.mock("@app/hooks/use-card-balance", () => ({
  useCardBalance: (cardId: string | undefined) => mockUseCardBalance(cardId),
}))

const cardWith = (status: CardStatus) => ({ id: "card-1", status })

const answerWith = ({
  card,
  hasLoaded = true,
  error,
}: {
  card?: ReturnType<typeof cardWith>
  hasLoaded?: boolean
  error?: Error
}) => mockUseCardData.mockReturnValue({ card, hasLoaded, error })

describe("useTransferCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsCardBackendAvailable.mockReturnValue(true)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
    mockUseCardBalance.mockReturnValue({ availableSats: 125000 })
    answerWith({ card: cardWith(CardStatus.Active) })
  })

  it("offers an active card with the sats it can spend", () => {
    const { result } = renderHook(() => useTransferCard())

    expect(mockUseCardData).toHaveBeenCalledWith({ skip: false })
    expect(mockUseCardBalance).toHaveBeenCalledWith("card-1")
    expect(result.current).toEqual({
      card: { id: "card-1", availableSats: 125000 },
      isPending: false,
    })
  })

  it("offers a frozen card, which still holds its balance", () => {
    answerWith({ card: cardWith(CardStatus.Locked) })

    const { result } = renderHook(() => useTransferCard())

    expect(result.current.card?.id).toBe("card-1")
  })

  it("leaves out a card that can no longer be used", () => {
    answerWith({ card: cardWith(CardStatus.Canceled) })

    const { result } = renderHook(() => useTransferCard())

    expect(result.current.card).toBeUndefined()
    expect(mockUseCardBalance).toHaveBeenCalledWith(undefined)
  })

  it("asks nothing where the card service is not available", () => {
    mockIsCardBackendAvailable.mockReturnValue(false)
    answerWith({ hasLoaded: false })

    const { result } = renderHook(() => useTransferCard())

    expect(mockUseCardData).toHaveBeenCalledWith({ skip: true })
    expect(result.current).toEqual({ card: undefined, isPending: false })
  })

  it("asks nothing for a self-custodial account, whose card belongs to another", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })
    answerWith({ hasLoaded: false })

    const { result } = renderHook(() => useTransferCard())

    expect(mockUseCardData).toHaveBeenCalledWith({ skip: true })
    expect(result.current.isPending).toBe(false)
  })

  it("waits while the card lookup has not answered", () => {
    answerWith({ hasLoaded: false })

    const { result } = renderHook(() => useTransferCard())

    expect(result.current).toEqual({ card: undefined, isPending: true })
  })

  it("stops waiting when the card lookup fails", () => {
    answerWith({ hasLoaded: false, error: new Error("Network request failed") })

    const { result } = renderHook(() => useTransferCard())

    expect(result.current).toEqual({ card: undefined, isPending: false })
  })
})
