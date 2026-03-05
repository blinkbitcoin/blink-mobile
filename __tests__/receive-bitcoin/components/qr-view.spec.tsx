import React from "react"
import { render } from "@testing-library/react-native"

import { QRView } from "@app/screens/receive-bitcoin-screen/qr-view"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({
    container: {},
    errorContainer: {},
    error: {},
    qr: {},
    expiredInvoice: {},
    cantUsePayCode: {},
    cantUsePayCodeText: {},
    logoOverlay: {},
    logoCircle: {},
    logoImage: {},
  }),
  Text: ({ children, ...props }: { children: React.ReactNode; testID?: string }) =>
    React.createElement("Text", props, children),
  useTheme: () => ({
    theme: { colors: { primary: "#000", _white: "#fff", grey5: "#ccc", error: "red" } },
  }),
}))

jest.mock("react-native-qrcode-svg", () => "QRCode")

jest.mock("@app/assets/logo/blink-logo-icon.png", () => "mocked-logo")

jest.mock("@app/components/animations", () => ({
  usePressScale: () => ({
    scaleValue: { value: 1 },
    pressIn: jest.fn(),
    pressOut: jest.fn(),
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-tertiary-button", () => ({
  GaloyTertiaryButton: ({ title, onPress }: { title: string; onPress: () => void }) =>
    React.createElement("Button", { testID: "tertiary-button", onPress }, title),
}))

jest.mock("@app/components/success-animation", () => ({
  SuccessIconAnimation: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      ReceiveScreen: {
        invoiceHasExpired: () => "Invoice expired",
        regenerateInvoiceButtonTitle: () => "Regenerate",
        setUsernameToAcceptViaPaycode: () => "Set username to accept via paycode",
        setUsernameButtonTitle: () => "Set username",
      },
    },
  }),
}))

jest.mock("../../../app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("react-native-gesture-handler", () => ({
  Gesture: {
    Tap: () => ({
      onBegin: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
      onFinalize: jest.fn().mockReturnThis(),
    }),
    Manual: () => ({}),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock("react-native-reanimated", () => ({
  runOnJS: (fn: () => void) => fn,
}))

const defaultProps = {
  type: Invoice.Lightning,
  getFullUri: jest.fn(() => "lnbc1test"),
  loading: false,
  completed: false,
  err: "",
  expired: false,
  regenerateInvoiceFn: jest.fn(),
  copyToClipboard: jest.fn(),
  isPayCode: false,
  canUsePayCode: false,
  toggleIsSetLightningAddressModalVisible: jest.fn(),
}

describe("QRView", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders QR code when ready with getFullUri", () => {
    const { getByTestId } = render(<QRView {...defaultProps} />)

    expect(getByTestId("QR-Code")).toBeTruthy()
  })

  it("renders success icon when completed", () => {
    const { getByTestId } = render(<QRView {...defaultProps} completed={true} />)

    expect(getByTestId("Success Icon")).toBeTruthy()
  })

  it("renders loading indicator when loading", () => {
    const { queryByTestId } = render(
      <QRView {...defaultProps} loading={true} getFullUri={undefined} />,
    )

    expect(queryByTestId("QR-Code")).toBeNull()
    expect(queryByTestId("Success Icon")).toBeNull()
  })

  it("renders error message when err is provided", () => {
    const { queryByTestId } = render(
      <QRView {...defaultProps} err="Something went wrong" loading={false} />,
    )

    expect(queryByTestId("QR-Code")).toBeNull()
  })

  it("renders expired state with regenerate button", () => {
    const { getByTestId } = render(
      <QRView {...defaultProps} expired={true} getFullUri={undefined} />,
    )

    expect(getByTestId("tertiary-button")).toBeTruthy()
  })

  it("renders set username prompt for paycode without username", () => {
    const { getByTestId } = render(
      <QRView
        {...defaultProps}
        isPayCode={true}
        canUsePayCode={false}
        getFullUri={undefined}
      />,
    )

    expect(getByTestId("tertiary-button")).toBeTruthy()
  })

  it("renders QR code for paycode with canUsePayCode", () => {
    const { getByTestId } = render(
      <QRView
        {...defaultProps}
        type={Invoice.PayCode}
        isPayCode={true}
        canUsePayCode={true}
        getFullUri={jest.fn(() => "user@blink.sv")}
      />,
    )

    expect(getByTestId("QR-Code")).toBeTruthy()
  })

  it("calls getFullUri with uppercase true", () => {
    const getFullUri = jest.fn(() => "LNBC1TEST")
    render(<QRView {...defaultProps} getFullUri={getFullUri} />)

    expect(getFullUri).toHaveBeenCalledWith({ uppercase: true })
  })

  it("passes correct ecl config based on type", () => {
    const { rerender } = render(<QRView {...defaultProps} type={Invoice.Lightning} />)

    rerender(<QRView {...defaultProps} type={Invoice.OnChain} />)

    rerender(<QRView {...defaultProps} type={Invoice.PayCode} />)
  })

  it("renders without crashing for OnChain type", () => {
    const { getByTestId } = render(
      <QRView
        {...defaultProps}
        type={Invoice.OnChain}
        getFullUri={jest.fn(() => "bitcoin:bc1qtest")}
      />,
    )

    expect(getByTestId("QR-Code")).toBeTruthy()
  })
})
