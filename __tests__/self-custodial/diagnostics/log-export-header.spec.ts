import { readFileSync } from "fs"
import { join } from "path"

import { it } from "@jest/globals"

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
  analyticsId: null,
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

  it("carries the analytics id right after the mode, when there is one to share", () => {
    const header = buildLogExportHeader({
      ...fields,
      accountMode: AccountMode.Enhanced,
      analyticsId: "3f1c2a9e-7b4d-4e58-9a61-0c2d8e5b7f10",
    })

    expect(header).toContain(
      "Account mode: enhanced\nAnalytics ID: 3f1c2a9e-7b4d-4e58-9a61-0c2d8e5b7f10\n",
    )
  })

  it.each([
    ["null", null],
    ["empty", ""],
  ])("carries no analytics id line when the id is %s", (_label, analyticsId) => {
    expect(buildLogExportHeader({ ...fields, analyticsId })).not.toContain("Analytics ID")
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
