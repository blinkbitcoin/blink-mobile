import { CardStatus, TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"
import {
  isCardFrozen,
  mapTransactionStatus,
} from "@app/screens/card-screen/utils/card-display"

describe("card-display utils", () => {
  describe("isCardFrozen", () => {
    it("returns true for Locked status", () => {
      expect(isCardFrozen(CardStatus.Locked)).toBe(true)
    })

    it("returns false for Active status", () => {
      expect(isCardFrozen(CardStatus.Active)).toBe(false)
    })

    it("returns false for Canceled status", () => {
      expect(isCardFrozen(CardStatus.Canceled)).toBe(false)
    })

    it("returns false for NotActivated status", () => {
      expect(isCardFrozen(CardStatus.NotActivated)).toBe(false)
    })
  })

  describe("mapTransactionStatus", () => {
    it("maps Pending to Pending", () => {
      expect(mapTransactionStatus(TransactionStatus.Pending)).toBe(
        CardTransactionUiStatus.Pending,
      )
    })

    it("maps Declined to Declined", () => {
      expect(mapTransactionStatus(TransactionStatus.Declined)).toBe(
        CardTransactionUiStatus.Declined,
      )
    })

    it("maps Reversed to Reversed", () => {
      expect(mapTransactionStatus(TransactionStatus.Reversed)).toBe(
        CardTransactionUiStatus.Reversed,
      )
    })

    it("maps Completed to Completed (default branch)", () => {
      expect(mapTransactionStatus(TransactionStatus.Completed)).toBe(
        CardTransactionUiStatus.Completed,
      )
    })
  })
})
