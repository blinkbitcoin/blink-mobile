import { signUpWithPassword } from "react-native-credentials-manager"

import {
  CredentialError,
  isSetupKeyCredential,
  mapCredentialError,
  savePasswordCredential,
  setupKeyCredentialName,
} from "@app/utils/credential-manager"

describe("savePasswordCredential", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("hands the username and password to the Credential Manager", async () => {
    const result = await savePasswordCredential("someone (2FA)", "SECRET")

    expect(signUpWithPassword).toHaveBeenCalledWith({
      username: "someone (2FA)",
      password: "SECRET",
    })
    expect(result).toEqual({ success: true })
  })

  /** The patched native module names the exception's class in the code: the message
   *  is the provider's, in any wording or language. */
  it("reads the user declining the sheet from the code, whatever the message", async () => {
    jest.mocked(signUpWithPassword).mockRejectedValueOnce(
      Object.assign(new Error("Activity is cancelled by the user."), {
        code: "USER_CANCELED",
      }),
    )

    expect(await savePasswordCredential("a", "b")).toMatchObject({
      success: false,
      error: CredentialError.UserCancelled,
    })
  })

  it("reads a phone with no password manager from the code", async () => {
    jest.mocked(signUpWithPassword).mockRejectedValueOnce(
      Object.assign(new Error("No create options available."), {
        code: "NO_CREATE_OPTION",
      }),
    )

    expect(await savePasswordCredential("a", "b")).toMatchObject({
      success: false,
      error: CredentialError.NoProvider,
    })
  })

  it("hands back any other failure as unknown, with its cause", async () => {
    const failure = Object.assign(new Error("Something broke"), {
      code: "CREDENTIAL_ERROR",
    })
    jest.mocked(signUpWithPassword).mockRejectedValueOnce(failure)

    expect(await savePasswordCredential("a", "b")).toEqual({
      success: false,
      error: CredentialError.Unknown,
      cause: failure,
    })
  })

  it("says the user declined the sheet", async () => {
    jest.mocked(signUpWithPassword).mockRejectedValueOnce(new Error("USER_CANCELED"))

    expect(await savePasswordCredential("a", "b")).toMatchObject({
      success: false,
      error: CredentialError.UserCancelled,
    })
  })

  it("says there is no password manager to save to", async () => {
    jest
      .mocked(signUpWithPassword)
      .mockRejectedValueOnce(new Error("NO_CREDENTIAL_AVAILABLE"))

    expect(await savePasswordCredential("a", "b")).toMatchObject({
      success: false,
      error: CredentialError.NoProvider,
    })
  })
})

describe("mapCredentialError", () => {
  it("reads any other failure as unknown", () => {
    expect(mapCredentialError(new Error("SOMETHING_ELSE"))).toBe(CredentialError.Unknown)
    expect(mapCredentialError("not an error")).toBe(CredentialError.Unknown)
  })
})

describe("setup key entries", () => {
  it("names the entry after its account, and tells it from a wallet backup", () => {
    const name = setupKeyCredentialName("someone")

    expect(name).toBe("someone (2FA)")
    expect(isSetupKeyCredential(name)).toBe(true)
    expect(isSetupKeyCredential("wallet-identifier")).toBe(false)
  })
})
