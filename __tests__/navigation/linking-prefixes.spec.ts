import { COMPATIBLE_LINK_PREFIXES } from "@app/navigation/linking-prefixes"

describe("compatible link prefixes", () => {
  it("supports both single-colon and double-slash bitcoin/lightning schemes", () => {
    expect(COMPATIBLE_LINK_PREFIXES).toEqual(
      expect.arrayContaining(["bitcoin://", "bitcoin:", "lightning://", "lightning:"]),
    )
  })
})
