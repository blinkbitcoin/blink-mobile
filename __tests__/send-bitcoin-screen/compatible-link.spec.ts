import { isCompatibleLink } from "../../app/screens/send-bitcoin-screen/compatible-link"

describe("isCompatibleLink", () => {
  it("accepts lowercase bitcoin and lightning schemes", () => {
    expect(isCompatibleLink("bitcoin:bc1qexampleaddress")).toBe(true)
    expect(isCompatibleLink("lightning:lnbc1exampleinvoice")).toBe(true)
  })

  it("accepts uppercase bitcoin and lightning schemes", () => {
    expect(isCompatibleLink("BITCOIN:bc1qexampleaddress")).toBe(true)
    expect(isCompatibleLink("LIGHTNING:lnbc1exampleinvoice")).toBe(true)
  })

  it("accepts http and https", () => {
    expect(isCompatibleLink("http://example.com")).toBe(true)
    expect(isCompatibleLink("https://example.com")).toBe(true)
  })

  it("rejects unsupported schemes and malformed input", () => {
    expect(isCompatibleLink("ftp://example.com")).toBe(false)
    expect(isCompatibleLink("not-a-url")).toBe(false)
  })
})
