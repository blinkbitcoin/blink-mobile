import { renderHook, act } from "@testing-library/react-native"

const mockRemoveSessionProfileByToken = jest.fn()
const mockSaveToken = jest.fn()

let mockGaloyAuthToken: string

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    removeSessionProfileByToken: (...args: readonly unknown[]) =>
      mockRemoveSessionProfileByToken(...args),
  },
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
    mockRemoveSessionProfileByToken.mockResolvedValue(true)
    mockSaveToken.mockResolvedValue(undefined)
    mockGaloyAuthToken = "custodial-token"
  })

  it("removes the stored profile for the live token and clears the token", async () => {
    await discard()

    expect(mockRemoveSessionProfileByToken).toHaveBeenCalledWith("custodial-token")
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })

  it("only clears the token when there is no active custodial session", async () => {
    mockGaloyAuthToken = ""
    await discard()

    expect(mockRemoveSessionProfileByToken).not.toHaveBeenCalled()
    expect(mockSaveToken).toHaveBeenCalledWith("")
  })
})
