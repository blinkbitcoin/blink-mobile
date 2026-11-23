/* eslint-disable camelcase */
import { describe, expect, it } from "@jest/globals"

import {
  regionCheckOutcome,
  ScRegionOutcome,
  type RegionCheckInputs,
} from "@app/self-custodial/region-check-outcome"

const settledAllowed: RegionCheckInputs = {
  isRestrictedRegion: false,
  isRestrictedRegionEvaluationPending: false,
  dollarBalance: false,
  transfer: false,
  isSettled: true,
  isRegionDetermined: true,
}

describe("regionCheckOutcome", () => {
  it("reports an allowed region with both gates open", () => {
    expect(regionCheckOutcome(settledAllowed)).toEqual({
      region_outcome: ScRegionOutcome.Allowed,
      dollar_balance_restricted: false,
      transfer_restricted: false,
    })
  })

  it("reports the sanctions verdict as restricted", () => {
    expect(regionCheckOutcome({ ...settledAllowed, isRestrictedRegion: true })).toEqual({
      region_outcome: ScRegionOutcome.Restricted,
      dollar_balance_restricted: false,
      transfer_restricted: false,
    })
  })

  it("counts a sanctions verdict even when the gates' country did not resolve", () => {
    expect(
      regionCheckOutcome({
        ...settledAllowed,
        isRestrictedRegion: true,
        isRegionDetermined: false,
      })?.region_outcome,
    ).toBe(ScRegionOutcome.Restricted)
  })

  it.each([
    {
      label: "the dollar balance",
      gates: { dollarBalance: true },
      dollar: true,
      transfer: false,
    },
    { label: "transfers", gates: { transfer: true }, dollar: false, transfer: true },
    {
      label: "both gates",
      gates: { dollarBalance: true, transfer: true },
      dollar: true,
      transfer: true,
    },
  ])("reports a resolved country that closes $label as restricted", (row) => {
    expect(regionCheckOutcome({ ...settledAllowed, ...row.gates })).toEqual({
      region_outcome: ScRegionOutcome.Restricted,
      dollar_balance_restricted: row.dollar,
      transfer_restricted: row.transfer,
    })
  })

  it("reports no resolved country as unknown, with the gates as they stand", () => {
    expect(
      regionCheckOutcome({
        ...settledAllowed,
        isRegionDetermined: false,
        dollarBalance: true,
        transfer: true,
      }),
    ).toEqual({
      region_outcome: ScRegionOutcome.Unknown,
      dollar_balance_restricted: true,
      transfer_restricted: true,
    })
  })

  it.each([
    ["the sanctions check is pending", { isRestrictedRegionEvaluationPending: true }],
    ["the feature gates have not settled", { isSettled: false }],
  ])("reports nothing while %s", (_label, pending) => {
    expect(regionCheckOutcome({ ...settledAllowed, ...pending })).toBeNull()
  })

  it("never carries a country", () => {
    const outcome = regionCheckOutcome({ ...settledAllowed, isRestrictedRegion: true })

    expect(Object.keys(outcome ?? {}).sort()).toEqual([
      "dollar_balance_restricted",
      "region_outcome",
      "transfer_restricted",
    ])
  })
})
