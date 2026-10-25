import { renderHook } from "@testing-library/react-native"

import { useEmailRemoval } from "@app/custodial/hooks/use-email-removal"
import { SettingsScreenDocument } from "@app/graphql/generated"

const EMAIL = "someone@example.com"

const mockUpdateCurrentProfile = jest.fn()
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const mockEmailDelete = jest.fn()
const mockReadAccount = jest.fn()
/** The account the settings hold, which a removal is for. */
let mockAccountId: string | undefined = "1"
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailDeleteMutation: () => [mockEmailDelete],
  useSettingsScreenLazyQuery: () => [mockReadAccount],
  useSettingsScreenQuery: () => ({ data: { me: { id: mockAccountId } } }),
}))

const REFUSAL = { message: "Refused" }

const emailDeleted = (errors: unknown[] = []) => ({
  data: { userEmailDelete: { errors } },
})

/** A request that may have reached the server, with no answer back. */
const lostAnswer = () =>
  Object.assign(new Error("network down"), { networkError: new Error("offline") })

/** The account as the server reads it back. */
const accountRead = (email: string | null) => ({
  data: { me: { id: "1", email: email ? { address: email } : null } },
})

const removeEmail = () => {
  const { result } = renderHook(() => useEmailRemoval())
  return result.current.remove()
}

// eslint-disable-next-line max-lines-per-function -- one hook's suite, sharing the mocked mutation and account read above
describe("useEmailRemoval", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = "1"
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
    mockEmailDelete.mockResolvedValue(emailDeleted())
  })

  it("removes the email with no code, and saves the profile", async () => {
    const refusal = await removeEmail()

    expect(refusal).toBeUndefined()
    expect(mockEmailDelete).toHaveBeenCalledWith({
      refetchQueries: [SettingsScreenDocument],
    })
    expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
  })

  it("hands back a refusal while the account still has the email", async () => {
    mockEmailDelete.mockResolvedValue(emailDeleted([REFUSAL]))
    mockReadAccount.mockResolvedValue(accountRead(EMAIL))

    expect(await removeEmail()).toEqual(REFUSAL)
    expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
  })

  /** A first removal landed with its answer lost: the one sent again finds nothing left,
   *  which is the removal asked for. */
  it("counts a refusal as removed once the account reads the email gone", async () => {
    mockEmailDelete.mockResolvedValue(emailDeleted([REFUSAL]))
    mockReadAccount.mockResolvedValue(accountRead(null))

    expect(await removeEmail()).toBeUndefined()
    expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
  })

  describe("a removal whose answer was lost", () => {
    it("counts as removed once the account reads the email gone", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(null))

      expect(await removeEmail()).toBeUndefined()
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
    })

    it("throws while the account still has the email", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(EMAIL))

      await expect(removeEmail()).rejects.toThrow("network down")
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    })

    it("throws when the account cannot be read", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockRejectedValue(new Error("still offline"))

      await expect(removeEmail()).rejects.toThrow("network down")
    })

    it("throws when the read answers with an error", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({
        ...accountRead(null),
        error: new Error("still offline"),
      })

      await expect(removeEmail()).rejects.toThrow("network down")
    })

    /** A session switched meanwhile reads another account. */
    it("throws when the read is of another account", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({ data: { me: { id: "2", email: null } } })

      await expect(removeEmail()).rejects.toThrow("network down")
    })

    it("throws when the settings hold no account to compare the read with", async () => {
      mockAccountId = undefined
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(null))

      await expect(removeEmail()).rejects.toThrow("network down")
    })

    it("throws when the read answers with no account", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({ data: { me: null } })

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
