import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider, createTheme } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { ActiveWalletStatus } from "@app/types/wallet"

const theme = createTheme({})

const mockUseActiveWallet = jest.fn()
const mockUseUsdbPrivacyWarning = jest.fn()

jest.mock("react-native-bootsplash", () => ({ hide: jest.fn(), isVisible: jest.fn() }))
jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: { isSupported: jest.fn(async () => false) },
  NfcTech: {},
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: () => undefined,
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/hooks/use-usdb-privacy-warning", () => ({
  useUsdbPrivacyWarning: (args: { enabled: boolean }) => mockUseUsdbPrivacyWarning(args),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => false,
}))

jest.mock("@app/hooks", () => ({
  useNotificationPermission: jest.fn(),
  usePriceConversion: () => ({ convertMoneyAmount: (a: unknown) => a }),
}))

jest.mock("@app/screens/receive-bitcoin-screen/hooks", () => ({
  useDisplayPaymentRequest: () => ({ displayPaymentRequest: "", showActions: false }),
  useNfcReceive: () => ({
    displayReceiveNfc: false,
    setDisplayReceiveNfc: jest.fn(),
    isNfcAmountModalOpen: false,
    closeNfcAmountModal: jest.fn(),
    handleNfcAmountSet: jest.fn(),
    showNfcButton: false,
    onNfcPress: jest.fn(),
  }),
  useOnchainResolver: () => ({ address: null }),
  usePaymentRequest: () => mockRequestState(),
  useReceiveCarousel: () => ({
    ref: { current: null },
    isOnChainPage: mockIsOnChainPage(),
    onchainWalletCurrency: WalletCurrency.Btc,
    syncOnchainWallet: jest.fn(),
    items: [],
    setIndex: jest.fn(),
  }),
  useReceiveFlow: () => ({
    handleSetAmount: jest.fn(),
    handleMemoBlur: jest.fn(),
    handleToggleWallet: jest.fn(),
    handleCopy: jest.fn(),
    handleShare: jest.fn(),
    receiveViaNFC: jest.fn(),
  }),
}))

jest.mock("@app/self-custodial/hooks", () => ({
  usePaymentRequest: () => mockRequestState(),
}))

jest.mock("@app/screens/receive-bitcoin-screen/my-ln-updates-sub", () => ({
  withMyLnUpdateSub: (Comp: unknown) => Comp,
}))
jest.mock("@app/screens/receive-bitcoin-screen/qr-view", () => ({ QRView: () => null }))
jest.mock("@app/screens/receive-bitcoin-screen/nfc-header-button", () => ({
  NfcHeaderButton: () => null,
}))
jest.mock("@app/components/qr-carousel", () => ({ QRCarousel: () => null }))
jest.mock("@app/components/receive-amount-row", () => ({ ReceiveAmountRow: () => null }))
jest.mock("@app/components/note-input", () => ({ NoteInput: () => null }))
jest.mock("@app/components/action-button", () => ({ ActionButton: () => null }))
jest.mock("@app/components/contextual-info", () => ({ ContextualInfo: () => null }))
jest.mock("@app/components/modal-nfc", () => ({ ModalNfc: () => null }))
jest.mock("@app/components/amount-input/amount-input-modal", () => ({
  AmountInputModal: () => null,
}))
jest.mock("@app/components/set-lightning-address-modal", () => ({
  SetLightningAddressModal: () => null,
}))
jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))
jest.mock("@app/components/usdb-privacy-warning-modal", () => ({
  UsdbPrivacyWarningModal: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => {
  const handler: ProxyHandler<object> = { get: () => new Proxy(() => "", handler) }
  return { useI18nContext: () => ({ LL: new Proxy({}, handler), locale: "en" }) }
})

let receivingCurrency: WalletCurrency = WalletCurrency.Btc
let isOnChainPage = false

const mockIsOnChainPage = () => isOnChainPage
const mockRequestState = () => ({
  state: "ready",
  type: "Lightning",
  receivingWalletDescriptor: { currency: receivingCurrency, id: "wallet-id" },
  unitOfAccountAmount: { amount: 0, currency: WalletCurrency.Btc },
  settlementAmount: { amount: 0, currency: WalletCurrency.Btc },
  convertMoneyAmount: (a: unknown) => a,
  memoChangeText: "",
  canUsePaycode: false,
})

import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <ReceiveScreen />
    </ThemeProvider>,
  )

const enabledArg = () =>
  mockUseUsdbPrivacyWarning.mock.calls.at(-1)?.[0] as { enabled: boolean } | undefined

describe("ReceiveScreen — USDB privacy warning trigger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    receivingCurrency = WalletCurrency.Btc
    isOnChainPage = false
    mockUseUsdbPrivacyWarning.mockReturnValue({
      isVisible: false,
      acknowledge: jest.fn(),
    })
  })

  it("arms the warning for a self-custodial account receiving Dollar", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })
    receivingCurrency = WalletCurrency.Usd

    renderScreen()

    expect(enabledArg()?.enabled).toBe(true)
  })

  it("leaves the warning disarmed for a self-custodial account receiving Bitcoin", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })
    receivingCurrency = WalletCurrency.Btc

    renderScreen()

    expect(enabledArg()?.enabled).toBe(false)
  })

  it("never arms the warning for a custodial account, even on the Dollar wallet", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Ready,
    })
    receivingCurrency = WalletCurrency.Usd

    renderScreen()

    expect(enabledArg()?.enabled).toBe(false)
  })
})
