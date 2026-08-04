import { renderHook, act } from "@testing-library/react-native"

import { useSelfCustodialInfoBulletinState } from "@app/hooks/use-self-custodial-info-bulletin-state"

const mockActiveWallet = jest.fn()
const mockAccountRegistry = jest.fn()
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockAccountRegistry(),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: string[]) => mockGetItem(...args),
  setItem: (...args: string[]) => mockSetItem(...args),
}))

const selfCustodialAccount = { type: "self-custodial", id: "test-self-custodial-uuid" }
const custodialAccount = { type: "custodial", id: "test-custodial-uuid" }

describe("useSelfCustodialInfoBulletinState", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveWallet.mockReturnValue({ isReady: true })
    mockAccountRegistry.mockReturnValue({ activeAccount: selfCustodialAccount })
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  it("hides while the dismissal flag is still loading", () => {
    mockGetItem.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    expect(result.current.shouldShow).toBe(false)
  })

  it("shows for a self-custodial account that has not dismissed it", async () => {
    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    expect(result.current.shouldShow).toBe(true)
  })

  it("hides for custodial accounts", async () => {
    mockAccountRegistry.mockReturnValue({ activeAccount: custodialAccount })

    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    expect(result.current.shouldShow).toBe(false)
  })

  it("hides while the active wallet is not ready (account switch in flight)", async () => {
    mockActiveWallet.mockReturnValue({ isReady: false })

    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    expect(result.current.shouldShow).toBe(false)
  })

  it("stays hidden when it was dismissed in a previous session", async () => {
    mockGetItem.mockResolvedValue("true")

    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    expect(result.current.shouldShow).toBe(false)
  })

  it("dismisses permanently and persists the flag per account", async () => {
    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.shouldShow).toBe(false)
    expect(mockSetItem).toHaveBeenCalledWith(
      "selfCustodialInfoBulletinDismissed:test-self-custodial-uuid",
      "true",
    )
  })

  it("does not persist a dismissal when there is no self-custodial account", async () => {
    mockAccountRegistry.mockReturnValue({ activeAccount: custodialAccount })

    const { result } = renderHook(() => useSelfCustodialInfoBulletinState())

    await act(async () => {})

    act(() => {
      result.current.dismiss()
    })

    expect(mockSetItem).not.toHaveBeenCalled()
  })
})
