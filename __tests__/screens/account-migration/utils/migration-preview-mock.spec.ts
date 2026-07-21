import {
  getMigrationPreviewMock,
  windDownMock,
} from "@app/screens/account-migration/utils/migration-preview-mock"

/** The backend reserve rule the drain solve must satisfy: max(0.5% half-down, 10 sats).
 *  Replicated here so the sweep tests that real contract, not the mock's own
 *  feeSats = balance - receive identity (which can never disagree with itself). */
const reserveForAmount = (amountSats: number): number => {
  const scaled = amountSats * 50
  const quotient = Math.floor(scaled / 10_000)
  const remainder = scaled % 10_000
  const percentageFee = remainder > 5_000 ? quotient + 1 : quotient
  return Math.max(percentageFee, 10)
}

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

  it("hands out the largest payout whose own reserve still fits the balance", () => {
    const drainRegimeBalances = [101, 500, 2110, 2111, 5000, 100_000, 10_000_000]

    drainRegimeBalances.forEach((balanceSats) => {
      const { receiveSats, feeSats } = getMigrationPreviewMock(balanceSats)

      /** No sat vanishes between the payout and the fee. */
      expect(receiveSats + feeSats).toBe(balanceSats)
      /** The payout plus its own reserve fits inside the balance. */
      expect(receiveSats + reserveForAmount(receiveSats)).toBeLessThanOrEqual(balanceSats)
      /** One more sat would not fit, so the payout is the largest possible. */
      expect(receiveSats + 1 + reserveForAmount(receiveSats + 1)).toBeGreaterThan(
        balanceSats,
      )
    })
  })

  it("rounds an exact-half percentage reserve down, keeping one more sat in the payout", () => {
    /** At 2512 the drain lands on 2500, whose 0.5% reserve is exactly 12.5 sats. Half-down
     *  keeps the reserve at 12 and the payout at 2500; half-up would shrink it to 2499. */
    expect(getMigrationPreviewMock(2512)).toEqual({
      balanceSats: 2512,
      feeSats: 12,
      feeCoveredByBlink: false,
      receiveSats: 2500,
    })
  })
})

describe("windDownMock dev switch", () => {
  it("stays off (null) so the account-closed lockout is never shipped to real users", () => {
    /** windDownMock is null exactly when IS_ACCOUNT_AFFECTED is false; this fails loudly if
     *  the developer toggle is ever committed as true. */
    expect(windDownMock).toBeNull()
  })
})
