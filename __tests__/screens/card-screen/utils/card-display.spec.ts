/**
 * @jest-environment ./jest.timezone-environment
 */

import { CardStatus, CardType, TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"
import {
  formatCalendarDate,
  formatCardExpiry,
  formatCardType,
  formatIssuedDate,
  isCardFrozen,
  isCardUsable,
  mapTransactionStatus,
  merchantIcon,
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

  describe("isCardUsable", () => {
    it("returns true for Active status", () => {
      expect(isCardUsable(CardStatus.Active)).toBe(true)
    })

    it("returns true for Locked status", () => {
      expect(isCardUsable(CardStatus.Locked)).toBe(true)
    })

    it("returns false for Canceled status", () => {
      expect(isCardUsable(CardStatus.Canceled)).toBe(false)
    })

    it("returns false for Failed status", () => {
      expect(isCardUsable(CardStatus.Failed)).toBe(false)
    })

    it("returns false for NotActivated status", () => {
      expect(isCardUsable(CardStatus.NotActivated)).toBe(false)
    })

    it("returns false for Requested status", () => {
      expect(isCardUsable(CardStatus.Requested)).toBe(false)
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

  describe("formatCardExpiry", () => {
    it("prints the expiry as the card does, month and two-digit year", () => {
      expect(formatCardExpiry("2029-09")).toBe("09/29")
    })

    it("has nothing to print until the issuer set an expiry", () => {
      expect(formatCardExpiry(null)).toBeNull()
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

  describe("merchantIcon", () => {
    it("shows the fork and knife for eating places, bars and fast food", () => {
      expect(merchantIcon("5812")).toBe("fork-knife")
      expect(merchantIcon("5813")).toBe("fork-knife")
      expect(merchantIcon("5814")).toBe("fork-knife")
    })

    it("shows the car for commuter transport, taxis, rideshare and buses", () => {
      expect(merchantIcon("4111")).toBe("car")
      expect(merchantIcon("4121")).toBe("car")
      expect(merchantIcon("4131")).toBe("car")
    })

    it("shows the store for codes next to those groups and for any other code", () => {
      expect(merchantIcon("5811")).toBe("storefront")
      expect(merchantIcon("5815")).toBe("storefront")
      expect(merchantIcon("4110")).toBe("storefront")
      expect(merchantIcon("4132")).toBe("storefront")
      expect(merchantIcon("5411")).toBe("storefront")
    })

    it("shows the store without a code", () => {
      expect(merchantIcon(undefined)).toBe("storefront")
      expect(merchantIcon(null)).toBe("storefront")
      expect(merchantIcon("")).toBe("storefront")
      expect(merchantIcon("not-a-code")).toBe("storefront")
    })
  })

  describe("formatCalendarDate", () => {
    it("writes the calendar date out in the locale", () => {
      expect(formatCalendarDate("2026-07-01", "en")).toBe("July 1, 2026")
      expect(formatCalendarDate("2026-07-01", "es")).toBe("1 de julio de 2026")
    })

    /** The file runs six hours west of Greenwich, where the device's midnight of New
     *  Year's Day is still the last day of the year before in UTC. */
    it("keeps the day as set, whatever the device's time zone", () => {
      expect(formatCalendarDate("2026-01-01", "en")).toBe("January 1, 2026")
    })
  })
})
