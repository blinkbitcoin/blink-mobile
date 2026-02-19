import { renderHook } from "@testing-library/react-hooks"

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

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useLnInvoiceCreateMutation: () => [jest.fn()],
  useLnNoAmountInvoiceCreateMutation: () => [jest.fn()],
  useLnUsdInvoiceCreateMutation: () => [jest.fn()],
  useOnChainAddressCurrentMutation: () => [jest.fn()],
}))

const mockUseLnUpdateHashPaid = jest.fn()
jest.mock("@app/graphql/ln-update-context", () => ({
  useLnUpdateHashPaid: () => mockUseLnUpdateHashPaid(),
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
  })

  it("returns null when wallet resolution is null", () => {
    mockUseWalletResolution.mockReturnValue(null)

    const { result } = renderHook(() => usePaymentRequest())

    expect(result.current).toBeNull()
  })

  it("creates PRCD with PayCode for BTC default wallet with username", () => {
    setupMocksWithPR()

    renderHook(() => usePaymentRequest())

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.PayCode }),
    )
  })

  it("creates PRCD with Lightning for wallet without username", () => {
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

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.Lightning }),
    )
  })

  it("creates PRCD with Lightning for USD default wallet even with username", () => {
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

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ type: Invoice.Lightning }),
    )
  })

  it("uses default expiration time for BTC wallet", () => {
    setupMocksWithPR()

    renderHook(() => usePaymentRequest())

    expect(mockCreatePaymentRequestCreationData).toHaveBeenCalledWith(
      expect.objectContaining({ expirationTime: 1440 }),
    )
  })
})
