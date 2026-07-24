import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CloudRestoreScreen } from "@app/screens/self-custodial/onboarding/restore/cloud-restore-screen"

import { flushEffects } from "../../../../helpers/flush-effects"
import { ContextForScreen } from "../../../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}))

const mockLoadCloudBackups = jest.fn()
const mockHandlePick = jest.fn()
const mockHandleDecrypt = jest.fn()
const mockSetPassword = jest.fn()

type RestoreState = {
  isLoading: boolean
  hasError: boolean
  isNotFound: boolean
  isPicker: boolean
  isPassword: boolean
  entries: ReadonlyArray<{ fileId: string; metadata: { walletIdentifier: string } }>
  password: string
  passwordError: string | null
  errorMessage: string | null
}

const idleState: RestoreState = {
  isLoading: false,
  hasError: false,
  isNotFound: false,
  isPicker: false,
  isPassword: false,
  entries: [],
  password: "",
  passwordError: null,
  errorMessage: null,
}

let restoreState: RestoreState = idleState

jest.mock(
  "@app/screens/self-custodial/onboarding/restore/hooks/use-cloud-restore",
  () => ({
    useCloudRestore: () => ({
      ...restoreState,
      setPassword: mockSetPassword,
      loadCloudBackups: mockLoadCloudBackups,
      handlePick: mockHandlePick,
      handleDecrypt: mockHandleDecrypt,
    }),
  }),
)

const renderScreen = async (state: Partial<RestoreState>) => {
  restoreState = { ...idleState, ...state }
  const utils = render(
    <ContextForScreen>
      <CloudRestoreScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return utils
}

describe("CloudRestoreScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    restoreState = idleState
  })

  it("shows the spinner while loading", async () => {
    const { getByTestId } = await renderScreen({ isLoading: true })

    expect(getByTestId("restore-loading")).toBeTruthy()
  })

  it("describes a missing backup on the not-found step", async () => {
    const { getByText, queryByTestId } = await renderScreen({ isNotFound: true })

    expect(getByText(LL.RestoreScreen.noBackupFound())).toBeTruthy()
    expect(getByText(LL.RestoreScreen.noBackupDescription())).toBeTruthy()
    expect(queryByTestId("restore-error-description")).toBeNull()
  })

  it("shows the resolved reason under the failure title", async () => {
    const reason = "Allow Google Drive access to back up your wallet, then try again."
    const { getByText, getByTestId } = await renderScreen({
      hasError: true,
      errorMessage: reason,
    })

    expect(getByText(LL.RestoreScreen.restoreFailed())).toBeTruthy()
    expect(getByTestId("restore-error-description")).toBeTruthy()
    expect(getByText(reason)).toBeTruthy()
  })

  it("omits the description when the failure carries no reason", async () => {
    const { getByText, queryByTestId } = await renderScreen({ hasError: true })

    expect(getByText(LL.RestoreScreen.restoreFailed())).toBeTruthy()
    expect(queryByTestId("restore-error-description")).toBeNull()
  })

  it("retries the download from the failure step", async () => {
    const { getByTestId } = await renderScreen({ hasError: true })

    fireEvent.press(getByTestId("retry-download-button"))

    expect(mockLoadCloudBackups).toHaveBeenCalled()
  })

  it("routes to the manual phrase flow from the failure step", async () => {
    const { getByTestId } = await renderScreen({ hasError: true })

    fireEvent.press(getByTestId("try-manual-button"))

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialRestorePhrase",
      expect.anything(),
    )
  })

  it("lists the backups on the picker step", async () => {
    const { getByTestId } = await renderScreen({
      isPicker: true,
      entries: [{ fileId: "file-1", metadata: { walletIdentifier: "pubkey1" } }],
    })

    expect(getByTestId("cloud-backup-picker-description")).toBeTruthy()
  })

  it("keeps the decrypt button disabled until a password is typed", async () => {
    const { getByTestId } = await renderScreen({ isPassword: true })

    expect(getByTestId("restore-decrypt-button")).toBeDisabled()
  })

  it("decrypts once a password is present", async () => {
    const { getByTestId } = await renderScreen({ isPassword: true, password: "hunter2" })

    fireEvent.press(getByTestId("restore-decrypt-button"))

    expect(mockHandleDecrypt).toHaveBeenCalled()
  })

  it("renders no step when none is active", async () => {
    const { queryByTestId } = await renderScreen({})

    expect(queryByTestId("restore-loading")).toBeNull()
    expect(queryByTestId("no-backup-title")).toBeNull()
    expect(queryByTestId("cloud-backup-picker-description")).toBeNull()
    expect(queryByTestId("restore-decrypt-button")).toBeNull()
  })
})
