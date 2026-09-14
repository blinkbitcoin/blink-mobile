import React from "react"
import { Alert } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import {
  act,
  fireEvent,
  render,
  waitFor,
  type RenderAPI,
} from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { Network } from "@app/graphql/generated"
import {
  DestinationDirection,
  InvalidDestinationReason,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { ScanningQRCodeScreen } from "@app/screens/send-bitcoin-screen/scanning-qrcode-screen"

import { ContextForScreen } from "../helper"

let lastReadCode: ((event: { nativeEvent: { codeStringValue: string } }) => void) | null =
  null

jest.mock("react-native-camera-kit", () => {
  const React = jest.requireActual("react")
  return {
    Camera: (props: {
      onReadCode?: (event: { nativeEvent: { codeStringValue: string } }) => void
    }) => {
      lastReadCode = props.onReadCode ?? null
      return React.createElement("Camera")
    },
    CameraType: { Back: "back" },
  }
})

jest.mock("react-native-permissions", () => ({
  check: jest.fn().mockResolvedValue("granted"),
  request: jest.fn().mockResolvedValue("granted"),
  PERMISSIONS: { IOS: { CAMERA: "ios-camera" }, ANDROID: { CAMERA: "android-camera" } },
  RESULTS: { GRANTED: "granted", UNAVAILABLE: "unavailable" },
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockReset = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
      reset: mockReset,
      goBack: mockGoBack,
    }),
    useIsFocused: () => true,
  }
})

const mockResolveDestination = jest.fn()
jest.mock(
  "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination",
  () => ({
    resolveDestination: (...args: unknown[]) => mockResolveDestination(...args),
  }),
)

const mockScanContext = jest.fn()
jest.mock("@app/hooks/use-scan-context", () => ({
  useScanContext: () => mockScanContext(),
}))

const mockSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  __esModule: true,
  default: { getString: jest.fn().mockResolvedValue("") },
}))

const mockDetect = jest.fn()
jest.mock("rn-qr-generator", () => ({
  __esModule: true,
  default: { detect: (...args: unknown[]) => mockDetect(...args) },
}))

const mockLaunchImageLibrary = jest.fn()
jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}))

const mockToastShow = jest.fn()
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
}))

jest.mock("@app/utils/toast", () => ({
  ...jest.requireActual("@app/utils/toast"),
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})

beforeAll(() => {
  loadLocale("en")
})

const renderScreen = async () => {
  const result = render(
    <ContextForScreen>
      <ScanningQRCodeScreen />
    </ContextForScreen>,
  )
  await waitFor(() => expect(lastReadCode).not.toBeNull())
  return result
}

const fireScan = async (qrPayload: string) => {
  await act(async () => {
    lastReadCode?.({ nativeEvent: { codeStringValue: qrPayload } })
  })
}

describe("ScanningQRCodeScreen", () => {
  const custodialScanContext = {
    myWalletIds: ["wallet-1"],
    bitcoinNetwork: Network.Mainnet,
    lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
  }
  const selfCustodialScanContext = {
    myWalletIds: ["wallet-1"],
    bitcoinNetwork: Network.Mainnet,
    lnurlDomains: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    lastReadCode = null
    mockScanContext.mockReturnValue(custodialScanContext)
    mockSelfCustodialWallet.mockReturnValue({ sdk: null })
    mockLaunchImageLibrary.mockResolvedValue({ assets: [] })
    mockDetect.mockResolvedValue({ values: [] })
  })

  it("calls resolveDestination with sdk=null when active wallet is custodial", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lightning" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("lnbc1qrcode")

    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: "lnbc1qrcode", inputSource: "qr" }),
      { sdk: null, network: mockSparkNetwork.Regtest },
      "blink.sv",
    )
  })

  it("calls resolveDestination with the SDK when active wallet is self-custodial", async () => {
    const sdk = { id: "self-custodial-sdk" }
    mockScanContext.mockReturnValue(selfCustodialScanContext)
    mockSelfCustodialWallet.mockReturnValue({ sdk })
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "spark" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("sparkrt1qabc")

    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: "sparkrt1qabc" }),
      { sdk, network: mockSparkNetwork.Regtest },
      "blink.sv",
    )
  })

  it("forwards adapter lnurlDomains=[] to resolveDestination in self-custodial mode (avoids intraledger lookup)", async () => {
    mockScanContext.mockReturnValue(selfCustodialScanContext)
    mockSelfCustodialWallet.mockReturnValue({ sdk: { id: "self-custodial-sdk" } })
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lnurl" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("alice@blink.sv")

    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({ lnurlDomains: [] }),
      expect.anything(),
      "blink.sv",
    )
  })

  it("forwards adapter lnurlDomains to resolveDestination in custodial mode", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lnurl" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("alice@blink.sv")

    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
      }),
      { sdk: null, network: mockSparkNetwork.Regtest },
      "blink.sv",
    )
  })

  it("navigates to sendBitcoinDetails on a valid Send destination", async () => {
    const dest = {
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lightning" },
      createPaymentDetail: jest.fn(),
    }
    mockResolveDestination.mockResolvedValue(dest)

    await renderScreen()
    await fireScan("lnbc1...")

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("sendBitcoinDetails", {
        paymentDestination: dest,
      }),
    )
  })

  it("navigates merchant choices to merchantSelection", async () => {
    const merchants = [
      {
        id: "blink-boltz-usdc-arbitrum",
        lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDC+Arbitrum@swap.blink.sv",
        category: "swap" as const,
        title: "USDC Arbitrum",
        description: "Swap sats to USDC on Arbitrum",
        companyName: "Boltz",
        termsUrl: "https://boltz.exchange/terms",
      },
      {
        id: "blink-boltz-usdt-ethereum",
        lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDT+Ethereum@swap.blink.sv",
        category: "swap" as const,
        title: "USDT Ethereum",
        description: "Swap sats to USDT on Ethereum",
        companyName: "Boltz",
        termsUrl: "https://boltz.exchange/terms",
      },
    ]
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        paymentType: "merchant",
        merchants,
      },
    })

    await renderScreen()
    await fireScan("0x52908400098527886E0F7030069857D2E4169EE7")

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("merchantSelection", { merchants }),
    )
    expect(mockReplace).not.toHaveBeenCalledWith("sendBitcoinDetails", expect.anything())
  })

  it("resets navigation to redeemBitcoinDetail on a valid Receive destination", async () => {
    const dest = {
      valid: true,
      destinationDirection: DestinationDirection.Receive,
      validDestination: { paymentType: "Lnurl" },
    }
    mockResolveDestination.mockResolvedValue(dest)

    await renderScreen()
    await fireScan("lnurlw1...")

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        routes: [
          { name: "Primary" },
          { name: "redeemBitcoinDetail", params: { receiveDestination: dest } },
        ],
      }),
    )
  })

  it("shows an Alert when the destination is unknown", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: false,
      invalidReason: InvalidDestinationReason.UnknownDestination,
      invalidPaymentDestination: {},
    })

    await renderScreen()
    await fireScan("garbage")

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("skips processing when bitcoinNetwork is unavailable (self-custodial not ready)", async () => {
    mockScanContext.mockReturnValue({
      myWalletIds: [],
      bitcoinNetwork: null,
      lnurlDomains: [],
    })

    await renderScreen()
    await fireScan("anything")

    expect(mockResolveDestination).not.toHaveBeenCalled()
  })

  it("does not re-resolve the same QR payload twice (scannedCache)", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lightning" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("lnbc1same")
    await fireScan("lnbc1same")

    expect(mockResolveDestination).toHaveBeenCalledTimes(1)
  })

  /**
   * pending gates every scan and is only cleared from this alert, so a rejection that
   * skipped the alert left the camera and the gallery button dead for the whole screen.
   */
  it("keeps scanning alive when resolving rejects with something that is not an Error", async () => {
    mockResolveDestination.mockRejectedValue({ code: "E_RESOLVE" })

    await renderScreen()
    await fireScan("lnbc1first")

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Unexpected error occurred",
        "",
        expect.anything(),
      ),
    )
    expect(mockReportError).toHaveBeenCalledWith(
      "scanning-qrcode",
      new Error('{"code":"E_RESOLVE"}'),
    )

    const [, , buttons] = alertSpy.mock.calls[0]
    await act(async () => {
      buttons?.[0].onPress?.()
    })

    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "Lightning" },
      createPaymentDetail: jest.fn(),
    })
    await fireScan("lnbc1second")

    expect(mockResolveDestination).toHaveBeenCalledTimes(2)
  })

  /**
   * The controls used to sit at fixed offsets from the window edge. From Android 15 the
   * window runs under the system bars, so those offsets put the gallery and clipboard
   * buttons behind the navigation bar and the close button behind the status bar.
   */
  describe("clearing the system bars", () => {
    const flattenedStyle = (node: { props: { style?: unknown } }) =>
      Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)) as Record<
        string,
        number | undefined
      >

    const styleOfAncestorWith = (node: ReactTestInstance | null, key: string) => {
      let current = node
      while (current) {
        const style = flattenedStyle(current)
        if (style[key] !== undefined) return style
        current = current.parent
      }
      throw new Error(`no ancestor carries a ${key} style`)
    }

    it("offsets the bottom controls by the bottom inset", async () => {
      const screen = await renderScreen()
      const gallery = screen.getByTestId("open-gallery")

      expect(styleOfAncestorWith(gallery, "bottom").bottom).toBe(48 + 24)
    })

    it("offsets the close button by the top inset", async () => {
      const screen = await renderScreen()
      const closeIcon = screen.UNSAFE_getAllByProps({ name: "close" })[0]
      const closeContainer = closeIcon.parent?.parent

      expect(flattenedStyle(closeContainer as never).marginTop).toBe(24 + 16)
    })
  })

  /**
   * A merchant till code resolves through an LNURL service, and that service failing
   * says nothing about the code. Reporting it as an invalid QR sent a shopper, and the
   * ticket they filed, after a parser bug that was not there.
   */
  it("tells the user the code could not be processed when the lnurl service fails", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: false,
      invalidReason: "LnurlServiceError",
      invalidPaymentDestination: { paymentType: "lnurl" },
    })

    await renderScreen()
    await fireScan("https://za.wigroup.co/bill/172366037")

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Code Not Available",
        expect.stringContaining("We could not process this code"),
        expect.anything(),
      ),
    )
    expect(alertSpy).not.toHaveBeenCalledWith(
      "Invalid QR Code",
      expect.anything(),
      expect.anything(),
    )
  })

  it("keeps scanning alive after the code could not be processed", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: false,
      invalidReason: "LnurlServiceError",
      invalidPaymentDestination: { paymentType: "lnurl" },
    })

    await renderScreen()
    await fireScan("https://za.wigroup.co/bill/172366037")

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    const [, , buttons] = alertSpy.mock.calls[0]
    await act(async () => {
      buttons?.[0].onPress?.()
    })

    await fireScan("https://za.wigroup.co/bill/172366038")

    expect(mockResolveDestination).toHaveBeenCalledTimes(2)
  })

  it("still reports an unknown non-url destination as an invalid QR", async () => {
    mockResolveDestination.mockResolvedValue({
      valid: false,
      invalidReason: "UnknownDestination",
      invalidPaymentDestination: { paymentType: "unknown" },
    })

    await renderScreen()
    await fireScan("not-a-destination")

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Invalid QR Code",
        expect.stringContaining("not a valid Bitcoin address"),
        expect.anything(),
      ),
    )
  })

  describe("picking a QR from the gallery", () => {
    const openGallery = async (screen: RenderAPI) => {
      await act(async () => {
        fireEvent.press(screen.getByTestId("open-gallery"))
      })
    }

    /**
     * The decoder holds the decoded bitmap and one integer per pixel on top of it, so an
     * unbounded photo is an out-of-memory crash rather than a slow read.
     */
    it("bounds the picked image before the decoder ever sees it", async () => {
      const screen = await renderScreen()
      await openGallery(screen)

      expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
        mediaType: "photo",
        maxWidth: 2048,
        maxHeight: 2048,
      })
    })

    it("resolves the QR found in the picked image", async () => {
      mockLaunchImageLibrary.mockResolvedValue({ assets: [{ uri: "file:///photo.jpg" }] })
      mockDetect.mockResolvedValue({ values: ["lnbc1fromgallery"] })
      mockResolveDestination.mockResolvedValue({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: { paymentType: "Lightning" },
        createPaymentDetail: jest.fn(),
      })

      const screen = await renderScreen()
      await openGallery(screen)

      expect(mockDetect).toHaveBeenCalledWith({ uri: "file:///photo.jpg" })
      await waitFor(() => expect(mockResolveDestination).toHaveBeenCalled())
      const [destination] = mockResolveDestination.mock.calls[0]
      expect(destination).toEqual(
        expect.objectContaining({ rawInput: "lnbc1fromgallery", inputSource: "qr" }),
      )
    })

    it("tells the user when the picked image holds no QR", async () => {
      mockLaunchImageLibrary.mockResolvedValue({ assets: [{ uri: "file:///photo.jpg" }] })
      mockDetect.mockResolvedValue({ values: [] })

      const screen = await renderScreen()
      await openGallery(screen)

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
      expect(mockResolveDestination).not.toHaveBeenCalled()
    })

    it("resolves nothing when the picker comes back empty", async () => {
      mockLaunchImageLibrary.mockResolvedValue({ assets: [] })

      const screen = await renderScreen()
      await openGallery(screen)

      expect(mockDetect).not.toHaveBeenCalled()
      expect(mockResolveDestination).not.toHaveBeenCalled()
    })

    /**
     * processInvoice drops whatever it is handed while a scan is in flight, so a picker
     * opened now would cost the user a trip through the gallery and end in silence.
     */
    it("stays shut while a scan is already in flight", async () => {
      mockResolveDestination.mockReturnValue(new Promise(() => {}))

      const screen = await renderScreen()
      await act(async () => {
        lastReadCode?.({ nativeEvent: { codeStringValue: "lnbc1inflight" } })
      })

      await openGallery(screen)

      expect(mockLaunchImageLibrary).not.toHaveBeenCalled()
    })

    it("surfaces a picker failure instead of dying on it", async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error("picker exploded"))

      const screen = await renderScreen()
      await openGallery(screen)

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith("Unexpected error occurred"),
      )
      expect(mockReportError).toHaveBeenCalledWith(
        "scanning-qrcode",
        new Error("picker exploded"),
      )
    })

    /**
     * A native module can reject with something that is not an Error, and narrowing the
     * catch on instanceof would drop those rejections with no alert and nothing reported.
     * What it rejected with belongs in error reporting, not in a dialog.
     */
    it("surfaces a picker rejection that is not an Error", async () => {
      mockLaunchImageLibrary.mockRejectedValue({ code: "E_PICKER_UNAVAILABLE" })

      const screen = await renderScreen()
      await openGallery(screen)

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith("Unexpected error occurred"),
      )
      expect(mockReportError).toHaveBeenCalledWith(
        "scanning-qrcode",
        new Error('{"code":"E_PICKER_UNAVAILABLE"}'),
      )
    })

    it("tells the user when the image library permission was refused", async () => {
      mockLaunchImageLibrary.mockResolvedValue({ errorCode: "permission" })

      const screen = await renderScreen()
      await openGallery(screen)

      await waitFor(() => expect(mockToastShow).toHaveBeenCalled())
      expect(mockDetect).not.toHaveBeenCalled()
    })

    it("does not go quiet when the picker fails for any other reason", async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        errorCode: "others",
        errorMessage: "Unsupported file type",
      })

      const screen = await renderScreen()
      await openGallery(screen)

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
      expect(mockReportError).toHaveBeenCalledWith(
        "scanning-qrcode",
        new Error("Image library failed: others Unsupported file type"),
      )
      expect(mockToastShow).not.toHaveBeenCalled()
      expect(mockDetect).not.toHaveBeenCalled()
    })
  })
})
