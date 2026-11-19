import { formatDestination } from "@app/screens/send-bitcoin-screen/format-destination"

const HOST = "blink.sv"

describe("formatDestination", () => {
  it("keeps the first 10 and last 8 characters of an on-chain address", () => {
    expect(
      formatDestination({
        destination: "bc1q6pwejxkd0gfr2m7fvs4yh3nh5ul7zc8smg9fq4aw",
        paymentType: "onchain",
        lnAddressHostname: HOST,
      }),
    ).toBe("bc1q6pwejx...mg9fq4aw")
  })

  it("shortens an invoice the same way", () => {
    expect(
      formatDestination({
        destination: "lnbc1pd8a3fqpp5xyzxyzxyzxyzxyzxyzSjj9i2vuK",
        paymentType: "lightning",
        lnAddressHostname: HOST,
      }),
    ).toBe("lnbc1pd8a3...jj9i2vuK")
  })

  it("leaves a destination that already fits alone", () => {
    expect(
      formatDestination({
        destination: "bc1qshortaddr",
        paymentType: "onchain",
        lnAddressHostname: HOST,
      }),
    ).toBe("bc1qshortaddr")
  })

  it("keeps a Lightning address whole", () => {
    expect(
      formatDestination({
        destination: "a-very-long-lightning-address-name@example.com",
        paymentType: "lnurl",
        lnAddressHostname: HOST,
      }),
    ).toBe("a-very-long-lightning-address-name@example.com")
  })

  it("appends the Blink host to a username", () => {
    expect(
      formatDestination({
        destination: "alice",
        paymentType: "intraledger",
        lnAddressHostname: HOST,
      }),
    ).toBe("alice@blink.sv")
  })
})
