import { describe, expect, it } from "@jest/globals"

import {
  buildSdkLogExport,
  redactPreimages,
} from "@app/self-custodial/diagnostics/build-sdk-log-export"

const HEX = "ab".repeat(32)
const HASH = "cd".repeat(32)

describe("redactPreimages", () => {
  it.each([
    ["a Debug Option", `preimage: Some("${HEX}")`, `preimage: Some("<redacted>")`],
    ["a bare Debug string", `preimage: "${HEX}"`, `preimage: "<redacted>"`],
    ["a JSON field", `"preimage":"${HEX}"`, `"preimage":"<redacted>"`],
    ["upper-case hex", `Preimage: ${HEX.toUpperCase()}`, `Preimage: <redacted>`],
  ])("rewrites %s", (_label, input, expected) => {
    expect(redactPreimages(input)).toBe(expected)
  })

  it.each([
    ["an absent preimage", "preimage: None"],
    ["one the SDK already redacted", `preimage: Some("<redacted>")`],
    ["a payment hash", `payment_hash: "${HASH}"`],
    ["a preimage on the next line", `preimage: None\npayment_hash: "${HASH}"`],
  ])("leaves %s alone", (_label, input) => {
    expect(redactPreimages(input)).toBe(input)
  })
})

describe("buildSdkLogExport", () => {
  it("puts the header first and each file under its marker, in the order given", () => {
    const exported = buildSdkLogExport({
      header: "Blink wallet logs\n",
      parts: [
        { name: "sdk.log.1", text: "older line\n" },
        { name: "sdk.log", text: "newer line\n" },
      ],
    })

    expect(exported).toBe(
      "Blink wallet logs\n\n--- sdk.log.1 ---\nolder line\n\n--- sdk.log ---\nnewer line\n",
    )
  })

  it("redacts preimages in every file", () => {
    const exported = buildSdkLogExport({
      header: "h",
      parts: [
        { name: "sdk.log.1", text: `preimage: Some("${HEX}")` },
        { name: "sdk.log", text: `preimage: Some("${HEX}")` },
      ],
    })

    expect(exported).not.toContain(HEX)
    expect(exported.match(/<redacted>/g)).toHaveLength(2)
  })
})
