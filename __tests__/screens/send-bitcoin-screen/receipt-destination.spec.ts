import { it } from "@jest/globals"

import { receiptDestination } from "@app/screens/send-bitcoin-screen/receipt-destination"

/** A BTCPay pay link with a query string, bech32-encoded: 142 characters. */
const btcpayLnurl =
  "LNURL1DP68GURN8GHJ7CN5VDCXZ7FWV4UXZMTSD3JJUCM0D5H5Y4ZR9A25JNZW24FYCTMSV9UJ76F0XAYXKVJ3D5U4SCF52F6YCAELVD6HYUN9DE3HJ0242DZZVCTDDA6KUAPAX5S4RG46"
const longInvoice = `lnbc10u1p${"5qk3z7tpp5qk3z7t".repeat(5)}`
const shortInvoice = "lnbc10u1p5qk3z7tpp5qk3z7tpp5qk3z7t"
const taprootAddress = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297"
const sparkAddress = `sp1${"pgss9qzk8dxs7ehvlwrjr3qyrmsy".repeat(3)}`

const shortened = (value: string) => `${value.slice(0, 13)}...${value.slice(-8)}`

describe("receiptDestination", () => {
  it.each([
    {
      case: "an intraledger handle in full",
      paymentType: "intraledger",
      destination: "alice",
      expected: "alice",
    },
    {
      case: "a Lightning address in full",
      paymentType: "lnurl",
      destination: "alice@getalby.com",
      expected: "alice@getalby.com",
    },
    {
      case: "a bech32 LNURL shortened",
      paymentType: "lnurl",
      destination: btcpayLnurl,
      expected: shortened(btcpayLnurl),
    },
    {
      case: "a long Lightning invoice shortened",
      paymentType: "lightning",
      destination: longInvoice,
      expected: shortened(longInvoice),
    },
    {
      case: "a Lightning invoice of 50 characters or less in full",
      paymentType: "lightning",
      destination: shortInvoice,
      expected: shortInvoice,
    },
    {
      case: "an on-chain address in full",
      paymentType: "onchain",
      destination: taprootAddress,
      expected: taprootAddress,
    },
    {
      case: "a Spark address in full",
      paymentType: "spark",
      destination: sparkAddress,
      expected: sparkAddress,
    },
  ] as const)("prints $case", ({ paymentType, destination, expected }) => {
    expect(receiptDestination(paymentType, destination)).toBe(expected)
  })
})
