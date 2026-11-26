import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { WalletCurrency } from "@app/graphql/generated"
import {
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { CARD } from "@app/types/amounts"
import { ActiveWalletStatus } from "@app/types/wallet"

const mockUseActiveWallet = jest.fn()
const mockUsePaymentRequest = jest.fn()
const mockUseSelfCustodialPaymentRequest = jest.fn()
const mockUseCardDepositRequest = jest.fn()
const mockUseReceiveCarousel = jest.fn()
const mockUseDisplayPaymentRequest = jest.fn()
const mockUseOnchainResolver = jest.fn()
const mockQRViewProps = jest.fn()
const mockAmountRowProps = jest.fn()
const mockNoteInputProps = jest.fn()
const mockActionButtonProps = jest.fn()
let mockRouteParams: { destination?: typeof CARD } | undefined

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
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: (cb: () => void) => cb(),
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/screens/receive-bitcoin-screen/hooks", () => ({
  useCardDepositRequest: () => mockUseCardDepositRequest(),
  useDisplayPaymentRequest: () => mockUseDisplayPaymentRequest(),
  useNfcReceive: jest.fn(() => ({})),
  useOnchainResolver: () => mockUseOnchainResolver(),
  usePaymentRequest: () => mockUsePaymentRequest(),
  useReceiveCarousel: () => mockUseReceiveCarousel(),
  useReceiveFlow: jest.fn(() => ({})),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceGated: () => false,
}))

jest.mock("@app/components/qr-carousel", () => ({
  QRCarousel: ({ page0, page1 }: { page0: React.ReactNode; page1: React.ReactNode }) => (
    <>
      {page0}
      {page1}
    </>
  ),
}))

jest.mock("@app/components/receive-amount-row", () => ({
  ReceiveAmountRow: (props: Record<string, unknown>) => {
    mockAmountRowProps(props)
    return null
  },
}))

jest.mock("@app/components/note-input", () => ({
  NoteInput: (props: Record<string, unknown>) => {
    mockNoteInputProps(props)
    return null
  },
}))

jest.mock("@app/components/action-button", () => ({
  ActionButton: (props: Record<string, unknown>) => {
    mockActionButtonProps(props)
    return null
  },
}))

jest.mock("@app/components/contextual-info", () => ({
  ContextualInfo: () => null,
}))

jest.mock("@app/components/amount-input/amount-input-modal", () => ({
  AmountInputModal: () => null,
}))

jest.mock("@app/self-custodial/hooks", () => ({
  usePaymentRequest: () => mockUseSelfCustodialPaymentRequest(),
}))

// eslint-disable-next-line prefer-const
let mockPriceConversionOverride: { convertMoneyAmount?: unknown } | null = null

jest.mock("@app/hooks", () => ({
  useNotificationPermission: jest.fn(),
  usePriceConversion: () =>
    mockPriceConversionOverride ?? {
      convertMoneyAmount: (
        moneyAmount: { amount: number; currency: string },
        toCurrency: string,
      ) => ({
        amount: moneyAmount.amount,
        currency: toCurrency,
        currencyCode: toCurrency,
      }),
    },
}))

jest.mock("@app/screens/receive-bitcoin-screen/my-ln-updates-sub", () => ({
  withMyLnUpdateSub: (Comp: unknown) => Comp,
}))

jest.mock("@app/screens/receive-bitcoin-screen/qr-view", () => ({
  QRView: (props: Record<string, unknown>) => {
    mockQRViewProps(props)
    return null
  },
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
    mockRouteParams = undefined
    mockPriceConversionOverride = null
    mockUseOnchainResolver.mockReturnValue({})
    mockUsePaymentRequest.mockReturnValue({ state: "ready" })
    mockUseSelfCustodialPaymentRequest.mockReturnValue({ state: "ready" })
  })

  it("renders a loader while price conversion is bootstrapping after an account switch", () => {
    mockPriceConversionOverride = { convertMoneyAmount: undefined }
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Ready,
    })

    const { getByTestId } = renderScreen()

    expect(getByTestId("receive-loading")).toBeTruthy()
  })

  it("renders nothing when self-custodial wallet is in Error status", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Error,
    })

    const { toJSON } = renderScreen()

    expect(toJSON()).toBeNull()
  })

  it("renders nothing when self-custodial wallet is in Unavailable status", () => {
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

  it("invokes BOTH custodial and self-custodial payment-request hooks regardless of mode (current behaviour, related to)", () => {
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

const cardRequest = (overrides: Record<string, unknown> = {}) => ({
  type: Invoice.Lightning,
  state: PaymentRequestState.Idle,
  setType: jest.fn(),
  setMemo: jest.fn(),
  setAmount: jest.fn(),
  switchReceivingWallet: jest.fn(),
  setExpirationTime: jest.fn(),
  regenerateInvoice: jest.fn(),
  expiresInSeconds: null,
  canSetExpirationTime: false,
  memoChangeText: "Card Balance Top-up",
  setMemoChangeText: jest.fn(),
  convertMoneyAmount: jest.fn(),
  receivingWalletDescriptor: { id: CARD, currency: WalletCurrency.Btc },
  canSetAmount: true,
  canSetMemo: false,
  canUsePaycode: false,
  lnAddressHostname: "",
  feesInformation: undefined,
  pr: null,
  destination: CARD,
  amountPrompt: "Set an amount",
  convertingMessage: "Adding to your Card Balance",
  requestOnchainAddress: jest.fn(),
  ...overrides,
})

const qrPropsFor = (type: string) =>
  mockQRViewProps.mock.calls
    .map(([props]) => props)
    .filter((props) => props.type === type)
    .pop()

describe("ReceiveScreen — Card Balance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams = { destination: CARD }
    mockPriceConversionOverride = null
    mockUseOnchainResolver.mockReturnValue({})
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Ready,
    })
    mockUseReceiveCarousel.mockReturnValue({
      isOnChainPage: false,
      onchainWalletCurrency: WalletCurrency.Btc,
      syncOnchainWallet: jest.fn(),
      handleSnap: jest.fn(),
    })
    mockUseDisplayPaymentRequest.mockReturnValue({
      displayPaymentRequest: "",
      showActions: true,
    })
    mockUseCardDepositRequest.mockReturnValue(cardRequest())
  })

  it("mints nothing on the wallets, since the payment lands in the Card Balance", () => {
    renderScreen()

    expect(mockUseCardDepositRequest).toHaveBeenCalled()
    expect(mockUsePaymentRequest).not.toHaveBeenCalled()
    expect(mockUseSelfCustodialPaymentRequest).not.toHaveBeenCalled()
  })

  it("shows a loader until the card deposit can count an amount", () => {
    mockUseCardDepositRequest.mockReturnValue(null)

    const { getByTestId } = renderScreen()

    expect(getByTestId("receive-loading")).toBeTruthy()
  })

  it("names the Card Balance in the pill, with no wallet to switch to", () => {
    renderScreen()

    expect(mockAmountRowProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ destination: CARD, canToggleWallet: false }),
    )
  })

  it("prefills the note and keeps it fixed", () => {
    renderScreen()

    expect(mockNoteInputProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: "Card Balance Top-up", editable: false }),
    )
  })

  it("asks for an amount on both pages, and names the crediting wait", () => {
    renderScreen()

    expect(qrPropsFor(Invoice.Lightning)).toMatchObject({
      prompt: "Set an amount",
      convertingMessage: "Adding to your Card Balance",
    })
    expect(qrPropsFor(Invoice.OnChain)).toMatchObject({
      prompt: "Set an amount",
      convertingMessage: "Adding to your Card Balance",
    })
  })

  it("says why the invoice failed when the deposit names it", () => {
    mockUseCardDepositRequest.mockReturnValue(
      cardRequest({ state: PaymentRequestState.Error, errorMessage: "Too many top-ups" }),
    )

    renderScreen()

    expect(qrPropsFor(Invoice.Lightning)?.err).toBe("Too many top-ups")
  })

  it("says why the address failed when the deposit names it", () => {
    mockUseOnchainResolver.mockReturnValue({ failed: true, address: null })
    mockUseCardDepositRequest.mockReturnValue(
      cardRequest({ onchainErrorMessage: "Could not load the address" }),
    )

    renderScreen()

    expect(qrPropsFor(Invoice.OnChain)?.err).toBe("Could not load the address")
  })

  it("asks blink-card for the address once the on-chain page is open", () => {
    const requestOnchainAddress = jest.fn()
    mockUseCardDepositRequest.mockReturnValue(cardRequest({ requestOnchainAddress }))

    const { rerender } = renderScreen()
    expect(requestOnchainAddress).not.toHaveBeenCalled()

    mockUseReceiveCarousel.mockReturnValue({
      isOnChainPage: true,
      onchainWalletCurrency: WalletCurrency.Btc,
      syncOnchainWallet: jest.fn(),
      handleSnap: jest.fn(),
    })
    rerender(
      <ThemeProvider theme={theme}>
        <ReceiveScreen />
      </ThemeProvider>,
    )

    expect(requestOnchainAddress).toHaveBeenCalledTimes(1)
  })

  it("offers no new address, since blink-card keeps one for the card", () => {
    mockUseReceiveCarousel.mockReturnValue({
      isOnChainPage: true,
      onchainWalletCurrency: WalletCurrency.Btc,
      syncOnchainWallet: jest.fn(),
      handleSnap: jest.fn(),
    })

    renderScreen()

    const icons = mockActionButtonProps.mock.calls.map(([props]) => props.icon)
    expect(icons).toContain("copy-paste")
    expect(icons).not.toContain("refresh")
  })

  const lastActionFor = (icon: string) =>
    mockActionButtonProps.mock.calls
      .map(([props]) => props)
      .filter((props) => props.icon === icon)
      .pop()

  it("keeps copy and share off until blink-card mints the invoice", () => {
    renderScreen()

    expect(lastActionFor("copy-paste")?.disabled).toBe(true)
    expect(lastActionFor("share")?.disabled).toBe(true)
  })

  it("offers copy and share once the invoice is minted", () => {
    const info = {
      data: {
        invoiceType: Invoice.Lightning,
        paymentRequest: "lnbc100",
        getFullUriFn: () => "lnbc100",
        getCopyableInvoiceFn: () => "lnbc100",
      },
    }
    mockUseCardDepositRequest.mockReturnValue(
      cardRequest({ state: PaymentRequestState.Created, amountPrompt: undefined, info }),
    )

    renderScreen()

    expect(lastActionFor("copy-paste")?.disabled).toBe(false)
    expect(lastActionFor("share")?.disabled).toBe(false)
  })
})
