import React from "react"
import { AppState } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"
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

type CameraError = (event: { nativeEvent: { errorMessage: string } }) => void

let lastReadCode: ReadCode | null = null
let lastCameraError: CameraError | null = null
jest.mock("react-native-camera-kit", () => {
  const ReactImpl = jest.requireActual("react")
  return {
    Camera: (props: { onReadCode?: ReadCode; onError?: CameraError }) => {
      lastReadCode = props.onReadCode ?? null
      lastCameraError = props.onError ?? null
      return ReactImpl.createElement("Camera")
    },
    CameraType: { Back: "back" },
  }
})

const mockCheck = jest.fn()
const mockRequest = jest.fn()
jest.mock("react-native-permissions", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
  request: (...args: unknown[]) => mockRequest(...args),
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

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
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

const appStateListeners = new Set<(state: string) => void>()

const bringAppToFront = async () => {
  await act(async () => {
    appStateListeners.forEach((listener) => listener("active"))
  })
  await flushEffects()
}

describe("SeedQrScannerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastReadCode = null
    lastCameraError = null
    appStateListeners.clear()
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      event: string,
      listener: (state: string) => void,
    ) => {
      if (event === "change") appStateListeners.add(listener)
      return { remove: () => appStateListeners.delete(listener) }
    }) as unknown as typeof AppState.addEventListener)
    mockCheck.mockResolvedValue("granted")
    mockRequest.mockResolvedValue("denied")
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

  it("keeps the camera off when screen protection fails", async () => {
    let rejectLease: (error: Error) => void = () => {}
    const ready = new Promise<void>((_, reject) => {
      rejectLease = reject
    })
    mockAcquireScreenSecurity.mockReturnValue({
      ready,
      release: jest.fn(() => Promise.resolve()),
    })

    const { getByText, getByTestId } = await renderScanner()
    expect(lastReadCode).toBeNull()

    await act(async () => {
      rejectLease(new Error("native failure"))
    })

    expect(lastReadCode).toBeNull()
    expect(getByText(LL.errors.screenSecurityUnavailable())).toBeTruthy()
    expect(getByTestId("screen-security-retry")).toBeTruthy()
    expect(getByTestId("screen-security-back")).toBeTruthy()
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

  it("opens the camera on return from Settings once access is granted there", async () => {
    mockCheck.mockResolvedValue("denied")
    const { getByText } = await renderScanner()
    expect(getByText(LL.ScanningQRCodeScreen.permissionCamera())).toBeTruthy()
    expect(mockRequest).toHaveBeenCalledTimes(1)

    mockCheck.mockResolvedValue("granted")
    await bringAppToFront()

    expect(lastReadCode).not.toBeNull()
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it("stays on the permission screen when Settings still denies the camera", async () => {
    mockCheck.mockResolvedValue("blocked")
    mockRequest.mockResolvedValue("blocked")
    const { getByText } = await renderScanner()

    await bringAppToFront()

    expect(getByText(LL.ScanningQRCodeScreen.permissionCamera())).toBeTruthy()
    expect(lastReadCode).toBeNull()
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it("takes down a camera that failed to start and offers Try Again or Back", async () => {
    const { getByText, getByTestId } = await renderScanner()
    const cameraError = lastCameraError
    if (!cameraError) throw new Error("camera has no error handler")

    lastReadCode = null
    act(() => cameraError({ nativeEvent: { errorMessage: "CameraX bind failed" } }))

    expect(lastReadCode).toBeNull()
    expect(getByText(LL.RestoreScreen.seedQrCameraFailed())).toBeTruthy()
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(String(mockReportError.mock.calls[0][1])).not.toContain("CameraX")

    fireEvent.press(getByTestId("seed-qr-scanner-back"))
    expect(mockGoBack).toHaveBeenCalledTimes(1)

    fireEvent.press(getByTestId("seed-qr-scanner-retry"))
    expect(lastReadCode).not.toBeNull()
  })
})
