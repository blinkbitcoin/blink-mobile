import { formatFeeTierOptions } from "@app/utils/format-fee-tier-options"

jest.mock("react-native-config", () => ({
  BREEZ_NETWORK: "regtest",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test",
}))

jest.mock("@app/utils/date", () => ({
  formatDuration: (value: number, opts: { unit: string }) =>
    `${value}${opts.unit === "minute" ? "m" : "h"}`,
}))

describe("formatFeeTierOptions", () => {
  const tiers = {
    fast: { feeSats: 500, etaMinutes: 10 },
    medium: { feeSats: 300, etaMinutes: 30 },
    slow: { feeSats: 100, etaMinutes: 60 },
  }

  const labels = {
    fast: "Fast",
    medium: "Medium",
    slow: "Slow",
  }

  it("formats options with label, detail, and id", () => {
    const result = formatFeeTierOptions({
      tiers,
      labels,
      formatSats: (sats) => `${sats} sats`,
      locale: "en",
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: "fast",
      label: "Fast (500 sats)",
      detail: "~ 10m",
    })
    expect(result[1]).toEqual({
      id: "medium",
      label: "Medium (300 sats)",
      detail: "~ 30m",
    })
    expect(result[2]).toEqual({
      id: "slow",
      label: "Slow (100 sats)",
      detail: "~ 60m",
    })
  })

  it("uses custom formatSats function", () => {
    const result = formatFeeTierOptions({
      tiers,
      labels,
      formatSats: (sats) => `${sats} sat/vB`,
      locale: "en",
    })

    expect(result[0].label).toBe("Fast (500 sat/vB)")
  })
})
