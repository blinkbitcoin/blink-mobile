import {
  getStateLabelKey,
  getPostalLabelKey,
} from "@app/screens/card-screen/utils/address-labels"

jest.mock(
  "@app/utils/address-metadata",
  () =>
    jest.requireActual<typeof import("../helpers/mock-address-metadata")>(
      "../helpers/mock-address-metadata",
    ).mockAddressMetadata,
)

describe("getStateLabelKey", () => {
  it("returns 'state' for US", () => {
    expect(getStateLabelKey("US")).toBe("state")
  })

  it("returns 'province' for CA", () => {
    expect(getStateLabelKey("CA")).toBe("province")
  })

  it("returns 'prefecture' for JP", () => {
    expect(getStateLabelKey("JP")).toBe("prefecture")
  })

  it("returns 'department' for SV", () => {
    expect(getStateLabelKey("SV")).toBe("department")
  })

  it("falls back to 'state' for unknown country", () => {
    expect(getStateLabelKey("XYZ")).toBe("state")
  })
})

describe("getPostalLabelKey", () => {
  it("returns 'zip' for US", () => {
    expect(getPostalLabelKey("US")).toBe("zip")
  })

  it("returns 'postalCode' for CA", () => {
    expect(getPostalLabelKey("CA")).toBe("postalCode")
  })

  it("returns 'postalCode' for JP", () => {
    expect(getPostalLabelKey("JP")).toBe("postalCode")
  })

  it("falls back to 'postalCode' for unknown country", () => {
    expect(getPostalLabelKey("XYZ")).toBe("postalCode")
  })
})
