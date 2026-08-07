import { renderHook, act } from "@testing-library/react-native"

const mockLogout = jest.fn()
const mockSaveToken = jest.fn()

let mockGaloyAuthToken: string

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ saveToken: mockSaveToken }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { galoyAuthToken: mockGaloyAuthToken },
  }),
}))

import { useDiscardCustodialSession } from "@app/screens/account-migration/hooks/use-discard-custodial-session"

const discard = async (isSessionAlive = true): Promise<void> => {
  const { result } = renderHook(() => useDiscardCustodialSession())
  await act(async () => {
    await result.current.discardCustodialSession({ isSessionAlive })
  })
}

describe("useDiscardCustodialSession", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    mockSaveToken.mockResolvedValue(undefined)
    mockGaloyAuthToken = "custodial-token"
  })

  it("logs the session out server-side without resetting the device state", async () => {
    await discard()

    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "custodial-token",
      isValidToken: true,
    })
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })

  /** Closing the account already deleted the Kratos identity and every session with it, so
   *  asking to revoke would fire a doomed mutation and report a failure on every migration. */
  it("skips the server-side revocation once the account has been closed", async () => {
    await discard(false)

    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "custodial-token",
      isValidToken: false,
    })
  })

  it("still clears the local token when the account has been closed", async () => {
    await discard(false)

    expect(mockSaveToken).toHaveBeenCalledWith("")
  })

  it("only clears the token when there is no active custodial session", async () => {
    mockGaloyAuthToken = ""
    await discard()

    expect(mockLogout).not.toHaveBeenCalled()
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })
})
