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

const discard = async (): Promise<void> => {
  const { result } = renderHook(() => useDiscardCustodialSession())
  await act(async () => {
    await result.current.discardCustodialSession()
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
    })
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })

  it("only clears the token when there is no active custodial session", async () => {
    mockGaloyAuthToken = ""
    await discard()

    expect(mockLogout).not.toHaveBeenCalled()
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })
})
