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

  it("keeps the flat 10-sat fee up to the last balance of the flat-reserve regime", () => {
    expect(getMigrationPreviewMock(2110)).toEqual({
      balanceSats: 2110,
      feeSats: 10,
      feeCoveredByBlink: false,
      receiveSats: 2100,
    })
  })

  it("folds the residual sat into the fee where the percentage reserve takes over", () => {
    expect(getMigrationPreviewMock(2111)).toEqual({
      balanceSats: 2111,
      feeSats: 11,
      feeCoveredByBlink: false,
      receiveSats: 2100,
    })
  })

  it("rounds the percentage reserve half-down like the backend does", () => {
    expect(getMigrationPreviewMock(5000)).toEqual({
      balanceSats: 5000,
      feeSats: 25,
      feeCoveredByBlink: false,
      receiveSats: 4975,
    })
  })

  it("charges the 0.5% reserve on large balances", () => {
    expect(getMigrationPreviewMock(100_000)).toEqual({
      balanceSats: 100_000,
      feeSats: 498,
      feeCoveredByBlink: false,
      receiveSats: 99_502,
    })
  })

  it("accounts for every sat between the fee and the receive amount across the backend sweep", () => {
    const backendSweepBalances = [
      0, 1, 10, 11, 50, 99, 100, 101, 500, 2110, 2111, 5000, 100_000, 10_000_000,
    ]

    backendSweepBalances.forEach((balanceSats) => {
      const preview = getMigrationPreviewMock(balanceSats)
      const feePaidByUser = preview.feeCoveredByBlink ? 0 : preview.feeSats
      expect(preview.balanceSats).toBe(balanceSats)
      expect(preview.receiveSats + feePaidByUser).toBe(balanceSats)
    })
  })
})
