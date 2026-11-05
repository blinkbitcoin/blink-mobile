import { renderHook, act } from "@testing-library/react-native"

import { useAddToWallet } from "@app/screens/card-screen/hooks/use-add-to-wallet"
import { WalletAddResult } from "@app/screens/card-screen/utils/wallet-provisioning"

const mockCanAddCardToWallet = jest.fn()
const mockAddCardToWallet = jest.fn()
jest.mock("@app/screens/card-screen/utils/wallet-provisioning", () => ({
  ...jest.requireActual("@app/screens/card-screen/utils/wallet-provisioning"),
  canAddCardToWallet: (...args: readonly unknown[]) => mockCanAddCardToWallet(...args),
  addCardToWallet: (...args: readonly unknown[]) => mockAddCardToWallet(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { errors: { unexpectedError: () => "Unexpected error occurred" } },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const renderWithCard = async (cardId = "card-1", lastFour = "4242") => {
  const hook = renderHook(
    ({ id, digits }: { id: string | undefined; digits: string | undefined }) =>
      useAddToWallet(id, digits),
    { initialProps: { id: cardId, digits: lastFour } },
  )
  await act(async () => {})
  return hook
}

describe("useAddToWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanAddCardToWallet.mockResolvedValue(true)
  })

  describe("eligibility", () => {
    it("cannot add without a card and never asks the wallet", async () => {
      const { result } = renderHook(() => useAddToWallet(undefined, undefined))
      await act(async () => {})

      expect(result.current.canAddToWallet).toBe(false)
      expect(mockCanAddCardToWallet).not.toHaveBeenCalled()
    })

    it("can add once the wallet accepts the card", async () => {
      const { result } = await renderWithCard()

      expect(mockCanAddCardToWallet).toHaveBeenCalledWith({
        cardId: "card-1",
        lastFour: "4242",
      })
      expect(result.current.canAddToWallet).toBe(true)
    })

    it("cannot add when the wallet turns the card down", async () => {
      mockCanAddCardToWallet.mockResolvedValue(false)

      const { result } = await renderWithCard()

      expect(result.current.canAddToWallet).toBe(false)
    })

    it("cannot add when the wallet check fails", async () => {
      mockCanAddCardToWallet.mockRejectedValue(new Error("wallet unreachable"))

      const { result } = await renderWithCard()

      expect(result.current.canAddToWallet).toBe(false)
    })

    it("ignores the answer for a card that is no longer shown", async () => {
      const staleCheck = deferred<boolean>()
      mockCanAddCardToWallet.mockReturnValueOnce(staleCheck.promise)
      mockCanAddCardToWallet.mockResolvedValueOnce(false)

      const { result, rerender } = await renderWithCard("card-1")
      rerender({ id: "card-2", digits: "4242" })
      await act(async () => {
        staleCheck.resolve(true)
      })

      expect(mockCanAddCardToWallet).toHaveBeenLastCalledWith({
        cardId: "card-2",
        lastFour: "4242",
      })
      expect(result.current.canAddToWallet).toBe(false)
    })
  })

  describe("addToWallet", () => {
    it("marks the card as being added until the wallet answers", async () => {
      const pendingAdd = deferred<WalletAddResult>()
      mockAddCardToWallet.mockReturnValue(pendingAdd.promise)
      const { result } = await renderWithCard()

      act(() => {
        result.current.addToWallet()
      })

      expect(result.current.isAdding).toBe(true)

      await act(async () => {
        pendingAdd.resolve(WalletAddResult.Added)
      })

      expect(result.current.isAdding).toBe(false)
    })

    it("stops offering the card once it is in the wallet", async () => {
      mockAddCardToWallet.mockResolvedValue(WalletAddResult.Added)
      const { result } = await renderWithCard()

      await act(async () => {
        await result.current.addToWallet()
      })

      expect(mockAddCardToWallet).toHaveBeenCalledWith({
        cardId: "card-1",
        lastFour: "4242",
      })
      expect(result.current.canAddToWallet).toBe(false)
    })

    it("keeps offering the card when the user cancels", async () => {
      mockAddCardToWallet.mockResolvedValue(WalletAddResult.Cancelled)
      const { result } = await renderWithCard()

      await act(async () => {
        await result.current.addToWallet()
      })

      expect(result.current.canAddToWallet).toBe(true)
      expect(result.current.isAdding).toBe(false)
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("shows an error and keeps offering the card when adding fails", async () => {
      mockAddCardToWallet.mockRejectedValue(new Error("provisioning failed"))
      const { result } = await renderWithCard()

      await act(async () => {
        await result.current.addToWallet()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unexpected error occurred" }),
      )
      expect(result.current.canAddToWallet).toBe(true)
      expect(result.current.isAdding).toBe(false)
    })

    it("does nothing without a card", async () => {
      const { result } = renderHook(() => useAddToWallet(undefined, undefined))
      await act(async () => {})

      await act(async () => {
        await result.current.addToWallet()
      })

      expect(mockAddCardToWallet).not.toHaveBeenCalled()
      expect(result.current.isAdding).toBe(false)
    })
  })
})
