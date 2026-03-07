import { isWeakPin } from "@app/screens/card-screen/pin-screens/validate-pin"

const WEAK_PINS = [
  "0000",
  "1111",
  "2222",
  "9999",
  "0123",
  "1234",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "9876",
  "8765",
  "7654",
  "6543",
  "5432",
  "4321",
  "3210",
]

const STRONG_PINS = ["5829", "7193", "2580", "3691", "8024", "4073"]

describe("isWeakPin", () => {
  for (const pin of WEAK_PINS) {
    it(`rejects weak PIN ${pin}`, () => {
      expect(isWeakPin(pin)).toBe(true)
    })
  }

  for (const pin of STRONG_PINS) {
    it(`accepts strong PIN ${pin}`, () => {
      expect(isWeakPin(pin)).toBe(false)
    })
  }
})
