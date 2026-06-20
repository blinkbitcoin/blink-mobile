import { act, renderHook } from "@testing-library/react-native"

import { SetUsernameError } from "@app/components/set-lightning-address-modal/username-validation"
import { useRegisterLightningAddress } from "@app/self-custodial/hooks/use-register-lightning-address"

const mockCheckAvailable = jest.fn()
const mockRegister = jest.fn()
jest.mock("@app/self-custodial/bridge", () => ({
  checkLightningAddressAvailable: (...args: unknown[]) => mockCheckAvailable(...args),
  registerLightningAddress: (...args: unknown[]) => mockRegister(...args),
}))

const mockUpdateAccount = jest.fn()
let mockSdk: unknown = { id: "sdk" }
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    sdk: mockSdk,
    updateCurrentSelfCustodialAccount: mockUpdateAccount,
  }),
}))

const FAKE_SDK = { id: "sdk" }

describe("useRegisterLightningAddress", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSdk = FAKE_SDK
    mockCheckAvailable.mockResolvedValue(true)
    mockRegister.mockResolvedValue({ lightningAddress: "alice@lnurl.staging.blink.sv" })
    mockUpdateAccount.mockResolvedValue(undefined)
  })

  it("registers a valid available username, refreshes the account and reports success", async () => {
    const onRegistered = jest.fn()
    const { result } = renderHook(() => useRegisterLightningAddress(onRegistered))

    act(() => result.current.setLnAddress("alice"))
    await act(async () => {
      await result.current.register()
    })

    expect(mockCheckAvailable).toHaveBeenCalledWith(FAKE_SDK, "alice")
    expect(mockRegister).toHaveBeenCalledWith(FAKE_SDK, "alice")
    expect(mockUpdateAccount).toHaveBeenCalledTimes(1)
    expect(onRegistered).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeUndefined()
    expect(result.current.loading).toBe(false)
  })

  it("surfaces a validation error and never touches the SDK for an invalid username", async () => {
    const onRegistered = jest.fn()
    const { result } = renderHook(() => useRegisterLightningAddress(onRegistered))

    act(() => result.current.setLnAddress("ab"))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.TOO_SHORT)
    expect(mockCheckAvailable).not.toHaveBeenCalled()
    expect(mockRegister).not.toHaveBeenCalled()
    expect(onRegistered).not.toHaveBeenCalled()
  })

  it("reports an unknown error when the SDK is not connected", async () => {
    mockSdk = null
    const { result } = renderHook(() => useRegisterLightningAddress(jest.fn()))

    act(() => result.current.setLnAddress("alice"))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.UNKNOWN_ERROR)
    expect(mockCheckAvailable).not.toHaveBeenCalled()
  })

  it("reports address-unavailable and does not register when the username is taken", async () => {
    mockCheckAvailable.mockResolvedValue(false)
    const onRegistered = jest.fn()
    const { result } = renderHook(() => useRegisterLightningAddress(onRegistered))

    act(() => result.current.setLnAddress("alice"))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.ADDRESS_UNAVAILABLE)
    expect(mockRegister).not.toHaveBeenCalled()
    expect(onRegistered).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it("reports an unknown error when registration throws", async () => {
    mockRegister.mockRejectedValue(new Error("server down"))
    const onRegistered = jest.fn()
    const { result } = renderHook(() => useRegisterLightningAddress(onRegistered))

    act(() => result.current.setLnAddress("alice"))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.UNKNOWN_ERROR)
    expect(onRegistered).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it("clears a previous error when the username is edited", async () => {
    const { result } = renderHook(() => useRegisterLightningAddress(jest.fn()))

    act(() => result.current.setLnAddress("ab"))
    await act(async () => {
      await result.current.register()
    })
    expect(result.current.error).toBe(SetUsernameError.TOO_SHORT)

    act(() => result.current.setLnAddress("alice"))

    expect(result.current.error).toBeUndefined()
  })

  it("surfaces the invalid-character error for a username with disallowed characters", async () => {
    const { result } = renderHook(() => useRegisterLightningAddress(jest.fn()))

    act(() => result.current.setLnAddress("invalid!name"))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.INVALID_CHARACTER)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it("surfaces the too-long error for an over-length username", async () => {
    const { result } = renderHook(() => useRegisterLightningAddress(jest.fn()))

    act(() => result.current.setLnAddress("a".repeat(51)))
    await act(async () => {
      await result.current.register()
    })

    expect(result.current.error).toBe(SetUsernameError.TOO_LONG)
  })

  it("keeps loading true while the registration request is in flight", async () => {
    let resolveCheck: (available: boolean) => void = () => {}
    mockCheckAvailable.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveCheck = resolve
      }),
    )
    const { result } = renderHook(() => useRegisterLightningAddress(jest.fn()))

    act(() => result.current.setLnAddress("alice"))
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.register()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveCheck(true)
      await pending
    })

    expect(result.current.loading).toBe(false)
  })
})
