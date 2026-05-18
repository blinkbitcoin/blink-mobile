import React from "react"
import { View } from "react-native"
import { act, render, waitFor } from "@testing-library/react-native"

import { ScanningQRCodeScreen } from "@app/screens/send-bitcoin-screen/scanning-qrcode-screen"
import { ContextForScreen } from "./helper"

const PUBKEY = "a".repeat(64)
const SECRET = "b".repeat(64)
const VALID_NWC_URI = `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}`

const mockReplace = jest.fn()
const mockGoBack = jest.fn()
let mockCameraProps: {
  onReadCode?: (event: { nativeEvent: { codeStringValue: string } }) => void
}

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useIsFocused: () => true,
    useNavigation: () => ({
      replace: mockReplace,
      goBack: mockGoBack,
    }),
  }
})

jest.mock("react-native-camera-kit", () => ({
  Camera: (props: typeof mockCameraProps) => {
    mockCameraProps = props
    return <View testID="camera" />
  },
  CameraType: {
    Back: "back",
  },
}))

jest.mock("react-native-permissions", () => ({
  check: jest.fn(() => Promise.resolve("granted")),
  request: jest.fn(() => Promise.resolve("granted")),
  PERMISSIONS: {
    IOS: { CAMERA: "ios.camera" },
    ANDROID: { CAMERA: "android.camera" },
  },
  RESULTS: {
    GRANTED: "granted",
    UNAVAILABLE: "unavailable",
  },
}))

jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn(),
}))

jest.mock("rn-qr-generator", () => ({
  detect: jest.fn(),
}))

jest.mock("@app/graphql/generated", () => {
  const actualGenerated = jest.requireActual("@app/graphql/generated")

  return {
    ...actualGenerated,
    useAccountDefaultWalletLazyQuery: () => [jest.fn()],
    useRealtimePriceQuery: jest.fn(),
    useScanningQrCodeScreenQuery: () => ({
      data: {
        globals: {
          network: "regtest",
        },
        me: {
          defaultAccount: {
            wallets: [{ id: "wallet-id" }],
          },
          contacts: [],
        },
      },
    }),
  }
})

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    displayCurrency: "USD",
  }),
}))

describe("ScanningQRCodeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCameraProps = {}
  })

  it("routes NWC QR codes to the authorization screen", async () => {
    render(
      <ContextForScreen>
        <ScanningQRCodeScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockCameraProps.onReadCode).toBeDefined())

    await act(async () => {
      mockCameraProps.onReadCode?.({
        nativeEvent: { codeStringValue: VALID_NWC_URI },
      })
    })

    expect(mockReplace).toHaveBeenCalledWith("nwcAuthorization", {
      uri: VALID_NWC_URI,
    })
  })
})
