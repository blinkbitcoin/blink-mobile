import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { ActiveWalletStatus } from "@app/types/wallet"

const mockUseActiveWallet = jest.fn()
const mockUsePaymentRequest = jest.fn()
const mockUseSelfCustodialPaymentRequest = jest.fn()

jest.mock("react-native-bootsplash", () => ({
  __esModule: true,
  default: { hide: jest.fn() },
}))

jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    isSupported: () => Promise.resolve(false),
  },
  Ndef: {},
  NdefRecord: {},
  NfcTech: {},
}))

jest.mock("@app/components/modal-nfc", () => ({
  ModalNfc: () => null,
}))

jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))

jest.mock("@app/components/set-lightning-address-modal", () => ({
  SetLightningAddressModal: () => null,
}))

jest.mock("@react-native-firebase/app-check", () => ({
  __esModule: true,
  default: () => ({
    newReactNativeFirebaseAppCheckProvider: () => ({ configure: jest.fn() }),
    initializeAppCheck: jest.fn(),
  }),
}))

jest.mock("@react-native-firebase/analytics", () => () => ({
  logScreenView: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (cb: () => void) => cb(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/screens/receive-bitcoin-screen/hooks", () => ({
  useDisplayPaymentRequest: jest.fn(() => ({})),
  useNfcReceive: jest.fn(() => ({})),
  useOnchainResolver: jest.fn(() => ({})),
  usePaymentRequest: () => mockUsePaymentRequest(),
  useReceiveCarousel: jest.fn(() => ({ items: [], setIndex: jest.fn() })),
  useReceiveFlow: jest.fn(() => ({})),
}))

jest.mock("@app/self-custodial/hooks", () => ({
  usePaymentRequest: () => mockUseSelfCustodialPaymentRequest(),
}))

jest.mock("@app/hooks", () => ({
  useNotificationPermission: jest.fn(),
}))

jest.mock("@app/screens/receive-bitcoin-screen/my-ln-updates-sub", () => ({
  withMyLnUpdateSub: (Comp: unknown) => Comp,
}))

jest.mock("@app/screens/receive-bitcoin-screen/qr-view", () => ({
  QRView: () => null,
}))

jest.mock("@app/screens/receive-bitcoin-screen/nfc-header-button", () => ({
  NfcHeaderButton: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => {
  // Recursive Proxy so any LL.<anything>... access returns a function returning ""
  const handler: ProxyHandler<object> = {
    get: () => new Proxy(() => "", handler),
  }
  return {
    useI18nContext: () => ({ LL: new Proxy({}, handler), locale: "en" }),
  }
})

import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <ReceiveScreen />
    </ThemeProvider>,
  )

describe("ReceiveScreen — routing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePaymentRequest.mockReturnValue({ state: "ready" })
    mockUseSelfCustodialPaymentRequest.mockReturnValue({ state: "ready" })
  })

  it("renders nothing when SC wallet is in Error status", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Error,
    })

    const { toJSON } = renderScreen()

    expect(toJSON()).toBeNull()
  })

  it("renders nothing when SC wallet is in Unavailable status", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Unavailable,
    })

    const { toJSON } = renderScreen()

    expect(toJSON()).toBeNull()
  })

  it("renders nothing when the picked request returns null/undefined", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Ready,
    })
    mockUsePaymentRequest.mockReturnValue(null)

    const { toJSON } = renderScreen()

    expect(toJSON()).toBeNull()
  })

  it("invokes BOTH custodial and SC payment-request hooks regardless of mode (current behaviour, related to I6)", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })
    // Force null so we never reach the heavy ReceiveScreenContent render but
    // both hooks still execute on the outer ReceiveScreen call.
    mockUsePaymentRequest.mockReturnValue(null)
    mockUseSelfCustodialPaymentRequest.mockReturnValue(null)

    renderScreen()

    expect(mockUsePaymentRequest).toHaveBeenCalled()
    expect(mockUseSelfCustodialPaymentRequest).toHaveBeenCalled()
  })

  it("invokes both hooks even when running as custodial", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Ready,
    })
    mockUsePaymentRequest.mockReturnValue(null)
    mockUseSelfCustodialPaymentRequest.mockReturnValue(null)

    renderScreen()

    expect(mockUsePaymentRequest).toHaveBeenCalled()
    expect(mockUseSelfCustodialPaymentRequest).toHaveBeenCalled()
  })
})
