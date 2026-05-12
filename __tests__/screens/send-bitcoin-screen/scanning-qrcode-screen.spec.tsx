import React from "react"
import { Alert } from "react-native"
import { act, render, waitFor } from "@testing-library/react-native"

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
jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  __esModule: true,
  default: { getString: jest.fn().mockResolvedValue("") },
}))

jest.mock("rn-qr-generator", () => ({
  __esModule: true,
  default: { detect: jest.fn().mockResolvedValue({ values: [] }) },
}))

jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({ assets: [] }),
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
      null,
    )
  })

  it("calls resolveDestination with the SDK when active wallet is self-custodial", async () => {
    const sdk = { id: "sc-sdk" }
    mockScanContext.mockReturnValue(selfCustodialScanContext)
    mockSelfCustodialWallet.mockReturnValue({ sdk })
    mockResolveDestination.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: { paymentType: "spark" },
      createPaymentDetail: jest.fn(),
    })

    await renderScreen()
    await fireScan("sp1qabc")

    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: "sp1qabc" }),
      sdk,
    )
  })

  it("forwards adapter lnurlDomains=[] to resolveDestination in self-custodial mode (avoids intraledger lookup)", async () => {
    mockScanContext.mockReturnValue(selfCustodialScanContext)
    mockSelfCustodialWallet.mockReturnValue({ sdk: { id: "sc-sdk" } })
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
      null,
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

  it("skips processing when bitcoinNetwork is unavailable (SC not ready)", async () => {
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
})
