import { getMigrationPreviewMock } from "@app/screens/account-migration/utils/backend-mock"

describe("getMigrationPreviewMock", () => {
  it("returns an all-zero preview for a zero balance", () => {
    expect(getMigrationPreviewMock(0)).toEqual({
      balanceSats: 0,
      feeSats: 0,
      feeCoveredByBlink: false,
      receiveSats: 0,
    })
  })

  it("treats a negative balance as zero", () => {
    expect(getMigrationPreviewMock(-5)).toEqual({
      balanceSats: 0,
      feeSats: 0,
      feeCoveredByBlink: false,
      receiveSats: 0,
    })
  })

  it("covers the fee at the de-minimis threshold so the whole balance moves", () => {
    expect(getMigrationPreviewMock(100)).toEqual({
      balanceSats: 100,
      feeSats: 10,
      feeCoveredByBlink: true,
      receiveSats: 100,
    })
  })

  it("charges the network fee just above the de-minimis threshold", () => {
    expect(getMigrationPreviewMock(101)).toEqual({
      balanceSats: 101,
      feeSats: 10,
      feeCoveredByBlink: false,
      receiveSats: 91,
    })
  })

  it("deducts the fee from a regular balance", () => {
    expect(getMigrationPreviewMock(1000)).toEqual({
      balanceSats: 1000,
      feeSats: 10,
      feeCoveredByBlink: false,
      receiveSats: 990,
    })
  })
})
