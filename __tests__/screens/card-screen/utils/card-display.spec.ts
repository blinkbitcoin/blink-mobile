import { CardStatus, CardType, TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"
import {
  formatCardType,
  formatIssuedDate,
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

  describe("formatCardType", () => {
    const mockLL = {
      cardTypeVirtual: () => "Virtual Visa debit",
      cardTypePhysical: () => "Physical Visa debit",
    }

    it("returns virtual label for Virtual type", () => {
      expect(formatCardType(CardType.Virtual, mockLL)).toBe("Virtual Visa debit")
    })

    it("returns physical label for Physical type", () => {
      expect(formatCardType(CardType.Physical, mockLL)).toBe("Physical Visa debit")
    })
  })

  describe("formatIssuedDate", () => {
    it("formats ISO date to localized string", () => {
      const result = formatIssuedDate("2025-04-23T12:00:00Z", "en")
      expect(result).toContain("April")
      expect(result).toContain("23")
      expect(result).toContain("2025")
    })

    it("formats with different locale", () => {
      const result = formatIssuedDate("2025-01-15T12:00:00Z", "es")
      expect(result).toContain("enero")
      expect(result).toContain("15")
      expect(result).toContain("2025")
    })
  })
})
