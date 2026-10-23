import React from "react"
import { Alert } from "react-native"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { AcceptTermsAndConditionsScreen } from "@app/screens/accept-t-and-c/accept-t-and-c"
import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen"
import { AccountMode } from "@app/types/account"
import { StorageFailure } from "@app/utils/storage/storage-failure"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
let mockFlow = "migration"
let mockMode: string | undefined
let mockHasRouteParams = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({
    params: mockHasRouteParams ? { flow: mockFlow, mode: mockMode } : undefined,
  }),
}))

const mockSaveCheckpoint = jest.fn()
const mockToastShow = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  ...jest.requireActual("@app/utils/toast"),
  toastShow: (args: unknown) => mockToastShow(args),
}))

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

let mockAppCheckToken: string | undefined
jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => mockAppCheckToken,
}))

const mockCreateDeviceAccountAndLogin = jest.fn()
jest.mock("@app/screens/get-started-screen/use-create-device-account", () => ({
  useCreateDeviceAccount: () => ({
    createDeviceAccountAndLogin: mockCreateDeviceAccountAndLogin,
    loading: false,
  }),
}))

const mockOpenInAppBrowser = jest.fn()
jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockOpenInAppBrowser(...args) },
}))

describe("AcceptTermsAndConditionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveCheckpoint.mockResolvedValue({ isSaved: true, failure: null })
    mockFlow = "migration"
    mockMode = undefined
    mockAppCheckToken = undefined
    mockHasRouteParams = true
    mockCreateDeviceAccountAndLogin.mockResolvedValue(undefined)
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

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod"),
    )
  })

  /** Two taps landing before React commits the busy button: the second must not issue a
   *  second save, whose answer would navigate a second time. */
  describe("while the acceptance is being saved", () => {
    let landSave: () => void = () => undefined
    beforeEach(() => {
      mockSaveCheckpoint.mockImplementation(
        () =>
          new Promise((resolve) => {
            landSave = () => resolve({ isSaved: true, failure: null })
          }),
      )
    })

    it("saves and advances once however fast the taps come", async () => {
      render(
        <ContextForScreen>
          <AcceptTermsAndConditionsScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      const { onPress } = screen.UNSAFE_getByType(GaloyPrimaryButton).props
      await act(async () => {
        onPress()
        onPress()
      })
      await act(async () => landSave())
      await flushEffects()

      expect(mockSaveCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledTimes(1)
    })

    it("shows the button busy until the save answers", async () => {
      render(
        <ContextForScreen>
          <AcceptTermsAndConditionsScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
      await flushEffects()
      expect(screen.UNSAFE_getByType(GaloyPrimaryButton).props.disabled).toBe(true)

      await act(async () => landSave())
      await flushEffects()

      expect(screen.UNSAFE_getByType(GaloyPrimaryButton).props.disabled).toBe(false)
    })
  })

  it("does not advance past the terms when the checkpoint write fails", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A Continue that answers a tap with nothing reads as a broken button, so the refusal
   *  has to be said out loud, and as the device's: "try again later" hides that the funds
   *  are safe and the problem is the store. */
  it("says the progress was not saved when the store refused", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: LL.AccountMigration.storageUnavailable.notSavedBody(),
      }),
    )
  })

  /** Turned away before it reached the store, for want of an owner: not the device's
   *  failure, so it is not blamed on the device. */
  it("keeps the generic apology for a write that never reached the store", async () => {
    mockSaveCheckpoint.mockResolvedValue({ isSaved: false, failure: null })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: LL.errors.generic() }),
    )
  })

  /** saveCheckpoint stays silent about a save it turned away before the store, so the
   *  screen reports it: once, however many taps the dropped owner lookup costs. */
  it("reports a save refused for want of an owner, once", async () => {
    mockSaveCheckpoint.mockResolvedValue({ isSaved: false, failure: null })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()
    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockSaveCheckpoint).toHaveBeenCalledTimes(2)
    const ownerlessReports = mockReportError.mock.calls.filter(
      ([operation]) => operation === "Migration terms",
    )
    expect(ownerlessReports).toHaveLength(1)
  })

  /** The store already reported its own refusal; a second report would double the event. */
  it("leaves a refusal the store reported to the store's report", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** The one failure the user can go and fix gets its own words. */
  it("names a full device rather than apologizing generically", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.OutOfSpace,
    })
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: LL.AccountMigration.storageUnavailable.notSavedOutOfSpaceBody(),
      }),
    )
  })

  it("says nothing when the write lands", async () => {
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
    await flushEffects()

    expect(mockToastShow).not.toHaveBeenCalled()
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
    await flushEffects()

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.BackupMethod)
  })

  it("routes the self-custodial creation flow to wallet creation, forwarding the mode", async () => {
    mockFlow = "selfCustodial"
    mockMode = AccountMode.Enhanced
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialWalletCreation", {
        mode: AccountMode.Enhanced,
      }),
    )
  })

  describe("outside the migration", () => {
    const renderAndAccept = async () => {
      render(
        <ContextForScreen>
          <AcceptTermsAndConditionsScreen />
        </ContextForScreen>,
      )
      await flushEffects()
      fireEvent.press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))
      await flushEffects()
    }

    it("sends the phone flow to the phone login", async () => {
      mockFlow = "phone"

      await renderAndAccept()

      expect(mockNavigate).toHaveBeenCalledWith("login", {
        type: PhoneLoginInitiateType.CreateAccount,
      })
    })

    it("treats a screen opened without params as the phone flow", async () => {
      mockHasRouteParams = false

      await renderAndAccept()

      expect(mockNavigate).toHaveBeenCalledWith("login", {
        type: PhoneLoginInitiateType.CreateAccount,
      })
    })

    it("sends a trial without an app check token to the phone login", async () => {
      mockFlow = "trial"

      await renderAndAccept()

      expect(mockCreateDeviceAccountAndLogin).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("login", {
        type: PhoneLoginInitiateType.CreateAccount,
      })
    })

    it("creates a device account for a trial with an app check token", async () => {
      mockFlow = "trial"
      mockAppCheckToken = "app-check-token"

      await renderAndAccept()

      expect(mockCreateDeviceAccountAndLogin).toHaveBeenCalledWith("app-check-token")
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("falls back to the phone login when the device account cannot be created", async () => {
      mockFlow = "trial"
      mockAppCheckToken = "app-check-token"
      mockCreateDeviceAccountAndLogin.mockRejectedValue(new Error("refused"))

      await renderAndAccept()

      expect(mockNavigate).toHaveBeenCalledWith("login", {
        type: PhoneLoginInitiateType.CreateAccount,
      })
    })

    it("flags a flow it does not know", async () => {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined)
      mockFlow = "unexpected"
      mockAppCheckToken = "app-check-token"

      await renderAndAccept()

      expect(alert).toHaveBeenCalledWith("unknown flow")
      alert.mockRestore()
    })
  })

  it("opens the terms and the blocked-countries page in the in-app browser", async () => {
    render(
      <ContextForScreen>
        <AcceptTermsAndConditionsScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(
      screen.getByText(LL.AcceptTermsAndConditionsScreen.termsAndConditions()),
    )
    fireEvent.press(
      screen.getByText(LL.AcceptTermsAndConditionsScreen.prohibitedCountry()),
    )

    expect(mockOpenInAppBrowser).toHaveBeenNthCalledWith(
      1,
      "https://www.blink.sv/en/terms-conditions",
    )
    expect(mockOpenInAppBrowser).toHaveBeenNthCalledWith(2, BLOCKED_COUNTRIES_FAQ_LINK)
  })
})
