import { renderHook } from "@testing-library/react-hooks"

import { flushEffects } from "../../helpers/flush-effects"

import { usePaymentRequest } from "@app/screens/receive-bitcoin-screen/hooks/use-payment-request"
import { WalletCurrency } from "@app/graphql/generated"
import {
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockConvertMoneyAmount = jest.fn(
  (amount: { amount: number; currency: string }) => amount,
)

const mockWallets = {
  defaultWallet: { id: "btc-id", balance: 50000, walletCurrency: WalletCurrency.Btc },
  bitcoinWallet: { id: "btc-id", balance: 50000, walletCurrency: WalletCurrency.Btc },
  usdWallet: { id: "usd-id", balance: 100, walletCurrency: WalletCurrency.Usd },
  username: "testuser",
  posUrl: "https://pay.blink.sv",
  lnAddressHostname: "blink.sv",
  convertMoneyAmount: mockConvertMoneyAmount,
  network: "mainnet",
  feesInformation: undefined,
}

const mockUseWalletResolution = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-wallet-resolution", () => ({
  useWalletResolution: () => mockUseWalletResolution(),
}))

// The mutation functions must keep a stable identity across renders: they
// feed the `mutations` useMemo in usePaymentRequest, and a fresh jest.fn()
// per render would re-trigger useInvoiceLifecycle's layout effect on every
// render, looping until React aborts with "Maximum update depth exceeded".
const mockLnInvoiceCreate = jest.fn()
const mockLnNoAmountInvoiceCreate = jest.fn()
const mockLnUsdInvoiceCreate = jest.fn()
const mockOnChainAddressCurrent = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useLnInvoiceCreateMutation: () => [mockLnInvoiceCreate],
  useLnNoAmountInvoiceCreateMutation: () => [mockLnNoAmountInvoiceCreate],
  useLnUsdInvoiceCreateMutation: () => [mockLnUsdInvoiceCreate],
  useOnChainAddressCurrentMutation: () => [mockOnChainAddressCurrent],
}))

const mockUseLnUpdateHashPaid = jest.fn()
jest.mock("@app/graphql/ln-update-context", () => ({
  useLnUpdateHashPaid: () => mockUseLnUpdateHashPaid(),
}))

const mockUseStablesatsRestricted = jest.fn(() => false)
jest.mock("@app/hooks/use-stablesats-restricted", () => ({
  useStablesatsRestricted: () => mockUseStablesatsRestricted(),
}))

const mockUseDeviceLocation = jest.fn(() => ({ countryCode: "SV", loading: false }))
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
}))

const mockUseCountdown = jest.fn()
jest.mock("@app/hooks", () => ({
  useCountdown: (...args: ReadonlyArray<Date | null>) => mockUseCountdown(...args),
}))

const mockCreatePaymentRequestCreationData = jest.fn()
jest.mock(
  "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data",
  () => ({
    createPaymentRequestCreationData: (...args: ReadonlyArray<Record<string, unknown>>) =>
      mockCreatePaymentRequestCreationData(...args),
  }),
)

const mockCreatePaymentRequest = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/payment/payment-request", () => ({
  createPaymentRequest: (...args: ReadonlyArray<Record<string, unknown>>) =>
    mockCreatePaymentRequest(...args),
}))

jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}))

const createFullMockPRCD = () => ({
  type: Invoice.PayCode,
  receivingWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-id" },
  canUsePaycode: true,
  canSetAmount: true,
  canSetMemo: true,
  canSetExpirationTime: true,
  canSetReceivingWalletDescriptor: true,
  username: "testuser",
  convertMoneyAmount: mockConvertMoneyAmount,
  setType: jest.fn(),
  setAmount: jest.fn(),
  setMemo: jest.fn(),
  setReceivingWalletDescriptor: jest.fn(),
  setExpirationTime: jest.fn(),
  setUsername: jest.fn(),
  setConvertMoneyAmount: jest.fn(),
  setDefaultWalletDescriptor: jest.fn(),
  setBitcoinWalletDescriptor: jest.fn(),
  defaultWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-id" },
  bitcoinWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-id" },
  posUrl: "https://pay.blink.sv",
  lnAddressHostname: "blink.sv",
  network: "mainnet",
  expirationTime: 1440,
})

type MockPR = {
  state: string
  info: undefined
  creationData: ReturnType<typeof createFullMockPRCD>
  setState: jest.Mock
  generateRequest: jest.Mock
}

const setupMocksWithPR = () => {
  const mockPRCD = createFullMockPRCD()
  mockCreatePaymentRequestCreationData.mockReturnValue(mockPRCD)

  const setStateFn = jest.fn()
  const generateRequestFn = jest.fn()

  const mockPR: MockPR = {
    state: PaymentRequestState.Idle,
    info: undefined,
    creationData: mockPRCD,
    setState: setStateFn,
    generateRequest: generateRequestFn,
  }

  setStateFn.mockImplementation((state: string) => ({
    state,
    info: undefined,
    creationData: mockPRCD,
    setState: setStateFn,
    generateRequest: generateRequestFn,
  }))

  generateRequestFn.mockResolvedValue({
    state: PaymentRequestState.Created,
    creationData: mockPRCD,
    info: undefined,
    setState: jest.fn(),
    generateRequest: jest.fn(),
  })

  mockCreatePaymentRequest.mockReturnValue(mockPR)
  mockUseWalletResolution.mockReturnValue(mockWallets)

  return { mockPRCD, mockPR }
}

describe("usePaymentRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseWalletResolution.mockReturnValue(null)
    mockUseLnUpdateHashPaid.mockReturnValue(null)
    mockUseCountdown.mockReturnValue({ remainingSeconds: null, isExpired: false })
    mockUseStablesatsRestricted.mockReturnValue(false)
    mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", loading: false })
  })

  it("returns null when wallet resolution is null", () => {
    mockUseWalletResolution.mockReturnValue(null)

    const { result } = renderHook(() => usePaymentRequest())

    expect(result.current).toBeNull()
  })

  it("creates PRCD with PayCode for BTC default wallet with username", async () => {
    setupMocksWithPR()

    renderHook(() => usePaymentRequest())

    // Settle generateRequest's async setPR inside act()
    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.PayCode }),
    )
  })

  it("creates PRCD with Lightning for wallet without username", async () => {
    const walletsNoUsername = { ...mockWallets, username: null }
    const mockPRCD = {
      ...createFullMockPRCD(),
      type: Invoice.Lightning,
      canUsePaycode: false,
    }
    mockCreatePaymentRequestCreationData.mockReturnValue(mockPRCD)
    mockCreatePaymentRequest.mockReturnValue({
      state: PaymentRequestState.Idle,
      creationData: mockPRCD,
      setState: jest.fn().mockReturnValue({
        state: PaymentRequestState.Loading,
        creationData: mockPRCD,
        setState: jest.fn(),
        generateRequest: jest.fn(),
      }),
      generateRequest: jest.fn().mockResolvedValue({
        state: PaymentRequestState.Created,
        creationData: mockPRCD,
      }),
    })
    mockUseWalletResolution.mockReturnValue(walletsNoUsername)

    renderHook(() => usePaymentRequest())

    // Settle generateRequest's async setPR inside act()
    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.Lightning }),
    )
  })

  it("creates PRCD with Lightning for USD default wallet even with username", async () => {
    const walletsUsdDefault = {
      ...mockWallets,
      defaultWallet: { id: "usd-id", balance: 100, walletCurrency: WalletCurrency.Usd },
    }
    const mockPRCD = { ...createFullMockPRCD(), type: Invoice.Lightning }
    mockCreatePaymentRequestCreationData.mockReturnValue(mockPRCD)
    mockCreatePaymentRequest.mockReturnValue({
      state: PaymentRequestState.Idle,
      creationData: mockPRCD,
      setState: jest.fn().mockReturnValue({
        state: PaymentRequestState.Loading,
        creationData: mockPRCD,
        setState: jest.fn(),
        generateRequest: jest.fn(),
      }),
      generateRequest: jest.fn().mockResolvedValue({
        state: PaymentRequestState.Created,
        creationData: mockPRCD,
      }),
    })
    mockUseWalletResolution.mockReturnValue(walletsUsdDefault)

    renderHook(() => usePaymentRequest())

    // Settle generateRequest's async setPR inside act()
    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.Lightning }),
    )
  })

  it("uses default expiration time for BTC wallet", async () => {
    setupMocksWithPR()

    renderHook(() => usePaymentRequest())

    // Settle generateRequest's async setPR inside act()
    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ expirationTime: 1440 }),
    )
  })

  it("forces the bitcoin wallet as default when stablesats is restricted", async () => {
    setupMocksWithPR()
    mockUseStablesatsRestricted.mockReturnValue(true)
    mockUseWalletResolution.mockReturnValue({
      ...mockWallets,
      defaultWallet: { id: "usd-id", balance: 100, walletCurrency: WalletCurrency.Usd },
    })

    renderHook(() => usePaymentRequest())

    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-id" },
      }),
    )
  })

  it("defers invoice creation until country detection settles", async () => {
    setupMocksWithPR()
    mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", loading: true })

    renderHook(() => usePaymentRequest())

    await flushEffects()

    expect(mockCreatePaymentRequestCreationData).not.toHaveBeenCalled()
  })
})
