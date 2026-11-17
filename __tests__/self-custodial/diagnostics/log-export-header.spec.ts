import { readFileSync } from "fs"
import { join } from "path"

import { BREEZ_SDK_VERSION } from "@app/self-custodial/config"
import {
  buildLogExportHeader,
  type LogExportHeaderFields,
} from "@app/self-custodial/diagnostics/log-export-header"
import { AccountMode } from "@app/types/account"

const fields: LogExportHeaderFields = {
  appVersion: "2.4.0.1234",
  os: "android",
  osVersion: 36,
  network: "mainnet",
  accountMode: AccountMode.Anon,
  selfCustodialAccountCount: 2,
  now: new Date("2026-10-28T09:05:07.000Z"),
}

describe("buildLogExportHeader", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("lists the context support needs, one field per line", () => {
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-120)

    expect(buildLogExportHeader(fields)).toBe(
      [
        "Blink wallet logs",
        "Exported: 2026-10-28T09:05:07.000Z (device time UTC+02:00)",
        "App: 2.4.0.1234",
        "OS: android 36",
        `Breez SDK: ${BREEZ_SDK_VERSION}`,
        "Network: mainnet",
        "Account mode: anon",
        "Self-custodial wallets on this device: 2",
        "",
      ].join("\n"),
    )
  })

  it("writes a zone behind UTC with a minus sign and its minutes", () => {
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(210)

    expect(buildLogExportHeader(fields)).toContain("(device time UTC-03:30)")
  })

  it("says so when no account mode has been chosen", () => {
    expect(buildLogExportHeader({ ...fields, accountMode: null })).toContain(
      "Account mode: not chosen",
    )
  })

  it("prints the SDK version that is actually installed", () => {
    const sdkPackage = JSON.parse(
      readFileSync(
        join(
          __dirname,
          "../../../node_modules/@breeztech/breez-sdk-spark-react-native/package.json",
        ),
        "utf8",
      ),
    )

    expect(BREEZ_SDK_VERSION).toBe(sdkPackage.version)
  })
})
