import { renderHook } from "@testing-library/react-native"

import { useAccountReadBack } from "@app/custodial/hooks/use-account-read-back"

const mockReadAccount = jest.fn()
/** The account the settings hold, which a change is sent for. */
let mockAccountId: string | undefined = "1"
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenLazyQuery: () => [mockReadAccount],
  useSettingsScreenQuery: () => ({ data: { me: { id: mockAccountId } } }),
}))

const ACCOUNT = { id: "1", phone: "+50760000000", email: null }

const readBack = () => {
  const { result } = renderHook(() => useAccountReadBack())
  return result.current.readBack(result.current.accountId)
}

describe("useAccountReadBack", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = "1"
    mockReadAccount.mockResolvedValue({ data: { me: ACCOUNT } })
  })

  it("hands back the account the change was sent for, read from the network", async () => {
    expect(await readBack()).toEqual(ACCOUNT)
  })

  /** A session switched meanwhile reads another account. */
  it("hands back nothing for another account", async () => {
    mockReadAccount.mockResolvedValue({ data: { me: { ...ACCOUNT, id: "2" } } })

    expect(await readBack()).toBeNull()
  })

  it("hands back nothing when the settings hold no account to compare with", async () => {
    mockAccountId = undefined

    expect(await readBack()).toBeNull()
  })

  it("hands back nothing when the read answers with no account", async () => {
    mockReadAccount.mockResolvedValue({ data: { me: null } })

    expect(await readBack()).toBeNull()
  })

  it("hands back nothing when the read answers with an error", async () => {
    mockReadAccount.mockResolvedValue({
      data: { me: ACCOUNT },
      error: new Error("still offline"),
    })

    expect(await readBack()).toBeNull()
  })

  it("hands back nothing when the read fails", async () => {
    mockReadAccount.mockRejectedValue(new Error("still offline"))

    expect(await readBack()).toBeNull()
  })
})
