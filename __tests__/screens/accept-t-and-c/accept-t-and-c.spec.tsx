import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { AcceptTermsAndConditionsScreen } from "@app/screens/accept-t-and-c/accept-t-and-c"
import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { flow: "migration" } }),
}))

const mockSaveCheckpoint = jest.fn()

/** Keeps the real device-location module (and its ip-country lookup) out of the suite. */
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({
    countryCode: "SV",
    loading: false,
    detectionFailed: false,
    source: "phone",
  }),
  useIpCountryCode: () => undefined,
  isBlockedCountry: () => false,
  LocationSource: { Phone: "phone", Ip: "ip" },
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({ saveCheckpoint: mockSaveCheckpoint }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ deviceAccountEnabled: false }),
}))

jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => undefined,
}))

jest.mock("@app/screens/get-started-screen/use-create-device-account", () => ({
  useCreateDeviceAccount: () => ({
    createDeviceAccountAndLogin: jest.fn(),
    loading: false,
  }),
}))

describe("AcceptTermsAndConditionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("continues the migration flow to the backup method on accept", async () => {
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })

  it("checkpoints past the terms only when Accept is pressed", async () => {
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.BackupMethod)
  })
})
