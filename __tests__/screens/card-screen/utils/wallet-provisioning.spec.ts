import {
  addCardToWallet,
  canAddCardToWallet,
  WalletAddResult,
} from "@app/screens/card-screen/utils/wallet-provisioning"

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (error: Error) => mockRecordAppError(error),
}))

const card = { cardId: "card-1", lastFour: "4242" }

describe("wallet provisioning", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reports that no wallet can take the card yet", async () => {
    await expect(canAddCardToWallet(card)).resolves.toBe(false)
  })

  it("refuses to add the card while no wallet can take it", async () => {
    await expect(addCardToWallet(card)).rejects.toThrow(
      "No device wallet can take the card yet",
    )
  })

  describe("one wallet add at a time", () => {
    it("joins the add already running for the same card", async () => {
      const first = addCardToWallet(card)
      const second = addCardToWallet(card)

      expect(second).toBe(first)
      await expect(first).rejects.toThrow("No device wallet can take the card yet")
      expect(mockRecordAppError).toHaveBeenCalledTimes(1)
      expect(mockRecordAppError).toHaveBeenCalledWith(
        new Error("No device wallet can take the card yet"),
      )
    })

    it("turns an add for another card away as busy while one is running", async () => {
      const first = addCardToWallet(card)

      await expect(addCardToWallet({ cardId: "card-2", lastFour: "1111" })).resolves.toBe(
        WalletAddResult.Busy,
      )
      await expect(first).rejects.toThrow("No device wallet can take the card yet")
    })

    it("starts a new add once the previous one settles", async () => {
      const first = addCardToWallet(card)
      await expect(first).rejects.toThrow()

      const second = addCardToWallet({ cardId: "card-2", lastFour: "1111" })

      expect(second).not.toBe(first)
      await expect(second).rejects.toThrow("No device wallet can take the card yet")
    })
  })
})
