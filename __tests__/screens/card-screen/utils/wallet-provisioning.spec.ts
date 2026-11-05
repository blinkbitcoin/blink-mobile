import {
  addCardToWallet,
  canAddCardToWallet,
} from "@app/screens/card-screen/utils/wallet-provisioning"

const card = { cardId: "card-1", lastFour: "4242" }

describe("wallet provisioning", () => {
  it("reports that no wallet can take the card yet", async () => {
    await expect(canAddCardToWallet(card)).resolves.toBe(false)
  })

  it("refuses to add the card while no wallet can take it", async () => {
    await expect(addCardToWallet(card)).rejects.toThrow(
      "No device wallet can take the card yet",
    )
  })
})
