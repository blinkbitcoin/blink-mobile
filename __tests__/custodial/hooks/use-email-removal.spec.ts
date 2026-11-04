import { renderHook } from "@testing-library/react-native"

import { useEmailRemoval } from "@app/custodial/hooks/use-email-removal"
import { SettingsScreenDocument } from "@app/graphql/generated"

const EMAIL = "someone@example.com"

const mockEmailDelete = jest.fn()
const mockReadAccount = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailDeleteMutation: () => [mockEmailDelete],
  useSettingsScreenLazyQuery: () => [mockReadAccount],
  useSettingsScreenQuery: () => ({ data: { me: { id: "1" } } }),
}))

const REFUSAL = { message: "Refused" }

const emailDeleted = (errors: unknown[] = []) => ({
  data: { userEmailDelete: { errors } },
})

/** A request that may have reached the server, with no answer back. */
const lostAnswer = () =>
  Object.assign(new Error("network down"), { networkError: new Error("offline") })

/** The account as the server reads it back. */
const accountRead = (email: string | null, id = "1") => ({
  data: { me: { id, email: email ? { address: email } : null } },
})

const removeEmail = () => {
  const { result } = renderHook(() => useEmailRemoval())
  return result.current.remove()
}

describe("useEmailRemoval", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmailDelete.mockResolvedValue(emailDeleted())
  })

  it("removes the email with no code", async () => {
    const refusal = await removeEmail()

    expect(refusal).toBeUndefined()
    expect(mockEmailDelete).toHaveBeenCalledWith({
      refetchQueries: [SettingsScreenDocument],
    })
    expect(mockReadAccount).not.toHaveBeenCalled()
  })

  it("hands back a refusal while the account still has the email", async () => {
    mockEmailDelete.mockResolvedValue(emailDeleted([REFUSAL]))
    mockReadAccount.mockResolvedValue(accountRead(EMAIL))

    expect(await removeEmail()).toEqual(REFUSAL)
  })

  /** A first removal landed with its answer lost: the one sent again finds nothing left,
   *  which is the removal asked for. */
  it("counts a refusal as removed once the account reads the email gone", async () => {
    mockEmailDelete.mockResolvedValue(emailDeleted([REFUSAL]))
    mockReadAccount.mockResolvedValue(accountRead(null))

    expect(await removeEmail()).toBeUndefined()
  })

  describe("a removal whose answer was lost", () => {
    it("counts as removed once the account reads the email gone", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(null))

      expect(await removeEmail()).toBeUndefined()
    })

    it("throws while the account still has the email", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(EMAIL))

      await expect(removeEmail()).rejects.toThrow("network down")
    })

    /** A session switched meanwhile reads another account. */
    it("throws when the read is of another account", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(null, "2"))

      await expect(removeEmail()).rejects.toThrow("network down")
    })
  })

  /** Only a lost answer may have landed: a failure the server sent back did not. */
  it("reads nothing after a failure that is not the network's", async () => {
    mockEmailDelete.mockRejectedValue(new Error("network"))

    await expect(removeEmail()).rejects.toThrow("network")
    expect(mockReadAccount).not.toHaveBeenCalled()
  })
})
