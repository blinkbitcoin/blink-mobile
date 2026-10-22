import React from "react"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { AcceptTermsAndConditionsScreen } from "@app/screens/accept-t-and-c/accept-t-and-c"
import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { AccountMode } from "@app/types/account"
import { StorageFailure } from "@app/utils/storage/storage-failure"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
let mockFlow = "migration"
let mockMode: string | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { flow: mockFlow, mode: mockMode } }),
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
    mockSaveCheckpoint.mockResolvedValue({ isSaved: true, failure: null })
    mockFlow = "migration"
    mockMode = undefined
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
})
