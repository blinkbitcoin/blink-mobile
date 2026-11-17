import React from "react"
import { act, render } from "@testing-library/react-native"
import { mnemonicToEntropy, wordlists } from "bip39"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { PhraseStep } from "@app/navigation/stack-param-lists"
import { SeedQrScannerScreen } from "@app/screens/self-custodial/onboarding/restore/seed-qr-scanner-screen"

import { ContextForScreen } from "../../../helper"
import { flushEffects } from "../../../../helpers/flush-effects"

type ReadCode = (event: {
  nativeEvent: { codeStringValue?: string; codeRawBase64?: string }
}) => void

let lastReadCode: ReadCode | null = null
jest.mock("react-native-camera-kit", () => {
  const ReactImpl = jest.requireActual("react")
  return {
    Camera: (props: { onReadCode?: ReadCode }) => {
      lastReadCode = props.onReadCode ?? null
      return ReactImpl.createElement("Camera")
    },
    CameraType: { Back: "back" },
  }
})

const mockCheck = jest.fn()
jest.mock("react-native-permissions", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
  request: jest.fn().mockResolvedValue("denied"),
  PERMISSIONS: { IOS: { CAMERA: "ios-camera" }, ANDROID: { CAMERA: "android-camera" } },
  RESULTS: { GRANTED: "granted", UNAVAILABLE: "unavailable" },
}))

const mockPopTo = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ popTo: mockPopTo, goBack: mockGoBack }),
  useIsFocused: () => true,
}))

type ToastArgs = {
  message: (LL: TranslationFunctions) => string
  onHide?: () => void
}
const mockToastShow = jest.fn<void, [ToastArgs]>()
jest.mock("@app/utils/toast", () => ({
  toastShow: (args: ToastArgs) => mockToastShow(args),
}))

const mockAcquireScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => mockAcquireScreenSecurity(),
}))

loadLocale("en")
const LL = i18nObject("en")

const PHRASE_12 =
  "attack pizza motion avocado network gather crop fresh patrol unusual wild holiday"
const STANDARD_12 = PHRASE_12.split(" ")
  .map((word) => String(wordlists.english.indexOf(word)).padStart(4, "0"))
  .join("")
const BAD_CHECKSUM = `${STANDARD_12.slice(0, 44)}0000`

const renderScanner = async () => {
  const result = render(
    <ContextForScreen>
      <SeedQrScannerScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return result
}

const scan = (nativeEvent: { codeStringValue?: string; codeRawBase64?: string }) => {
  if (!lastReadCode) throw new Error("camera was not rendered")
  const readCode = lastReadCode
  act(() => readCode({ nativeEvent }))
}

describe("SeedQrScannerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastReadCode = null
    mockCheck.mockResolvedValue("granted")
    mockAcquireScreenSecurity.mockReturnValue({
      ready: Promise.resolve(),
      release: jest.fn(() => Promise.resolve()),
    })
  })

  it("keeps screen protection on while the camera runs", async () => {
    await renderScanner()
    expect(mockAcquireScreenSecurity).toHaveBeenCalled()
    expect(lastReadCode).not.toBeNull()
  })

  it("hands a Standard SeedQR's words back to step 1 as a scan", async () => {
    await renderScanner()
    scan({ codeStringValue: STANDARD_12 })
    expect(mockPopTo).toHaveBeenCalledWith("selfCustodialRestorePhrase", {
      step: PhraseStep.First,
      scannedWords: PHRASE_12.split(" "),
    })
  })

  it("reads a CompactSeedQR from the raw bytes, not the text", async () => {
    await renderScanner()
    scan({
      codeStringValue: "��",
      codeRawBase64: Buffer.from(mnemonicToEntropy(PHRASE_12), "hex").toString("base64"),
    })
    expect(mockPopTo).toHaveBeenCalledWith("selfCustodialRestorePhrase", {
      step: PhraseStep.First,
      scannedWords: PHRASE_12.split(" "),
    })
  })

  it("acts on one scan only, however often the camera reports it", async () => {
    await renderScanner()
    scan({ codeStringValue: STANDARD_12 })
    scan({ codeStringValue: STANDARD_12 })
    scan({ codeStringValue: "https://blink.sv" })
    expect(mockPopTo).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("toasts the fixed copy for each kind of rejected code", async () => {
    await renderScanner()
    scan({ codeStringValue: BAD_CHECKSUM })
    scan({ codeStringValue: "https://blink.sv" })
    const messages = mockToastShow.mock.calls.map(([args]) => args.message(LL))
    expect(messages).toEqual([
      LL.RestoreScreen.seedQrInvalid(),
      LL.RestoreScreen.seedQrNotSeedQr(),
    ])
    expect(mockPopTo).not.toHaveBeenCalled()
  })

  it("never puts what it read into the toast", async () => {
    await renderScanner()
    scan({ codeStringValue: BAD_CHECKSUM })
    const [[args]] = mockToastShow.mock.calls
    expect(args.message(LL)).not.toContain(BAD_CHECKSUM.slice(0, 8))
    expect(JSON.stringify(args)).not.toContain(BAD_CHECKSUM.slice(0, 8))
  })

  it("toasts a code held in view once, and again after the toast hides", async () => {
    await renderScanner()
    scan({ codeStringValue: "https://blink.sv" })
    scan({ codeStringValue: "https://blink.sv" })
    expect(mockToastShow).toHaveBeenCalledTimes(1)

    act(() => mockToastShow.mock.calls[0][0].onHide?.())
    scan({ codeStringValue: "https://blink.sv" })
    expect(mockToastShow).toHaveBeenCalledTimes(2)
  })

  it("asks for the camera when permission is missing", async () => {
    mockCheck.mockResolvedValue("denied")
    const { getByText } = await renderScanner()
    expect(getByText(LL.ScanningQRCodeScreen.permissionCamera())).toBeTruthy()
    expect(getByText(LL.ScanningQRCodeScreen.openSettings())).toBeTruthy()
    expect(lastReadCode).toBeNull()
  })
})
