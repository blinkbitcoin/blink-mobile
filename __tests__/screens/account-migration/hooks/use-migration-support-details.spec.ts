import { renderHook, waitFor } from "@testing-library/react-native"

import { useMigrationSupportDetails } from "@app/screens/account-migration/hooks/use-migration-support-details"

const mockUseMigrationSupportDetailsQuery = jest.fn()
let mockMnemonic = ""
let mockLoadMnemonic: () => Promise<string> = () => Promise.resolve(mockMnemonic)

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationSupportDetailsQuery: () => mockUseMigrationSupportDetailsQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useLoadWalletMnemonic: () => () => mockLoadMnemonic(),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "Regtest",
}))

let mockDeriveRejects = false

const mockDerive = jest.fn((mnemonic: string) =>
  mockDeriveRejects
    ? Promise.reject(new Error("signer unavailable"))
    : Promise.resolve(mnemonic ? "02abc123pubkey" : ""),
)

jest.mock("@app/self-custodial/bridge", () => ({
  deriveWalletIdentityPubkey: (mnemonic: string) => mockDerive(mnemonic),
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

describe("useMigrationSupportDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMnemonic = "abandon ability able"
    mockDeriveRejects = false
    mockLoadMnemonic = () => Promise.resolve(mockMnemonic)
    mockUseMigrationSupportDetailsQuery.mockReturnValue({
      loading: false,
      data: {
        me: {
          id: "user-1",
          phone: "+1 374 9383 993",
          username: "satoshin21",
          email: { address: "email@email.com" },
          defaultAccount: { id: "18A4242" },
        },
      },
    })
  })

  it("maps the custodial identity and the pubkey derived from a lazily-loaded phrase", async () => {
    const { result } = renderHook(() => useMigrationSupportDetails())

    await waitFor(() => expect(result.current.pubKey).toBe("02abc123pubkey"))

    expect(result.current).toEqual({
      accountId: "18A4242",
      pubKey: "02abc123pubkey",
      username: "satoshin21",
      email: "email@email.com",
      phone: "+1 374 9383 993",
    })
  })

  /** Derivation became async in SDK 0.22; a rejection must settle to an empty pubkey and
   *  leave the rest of the support details intact, not surface as an unhandled promise. */
  it("settles with an empty pubkey when the derivation rejects, and reports it", async () => {
    mockDeriveRejects = true

    const { result } = renderHook(() => useMigrationSupportDetails())

    await waitFor(() => expect(result.current.accountId).toBe("18A4242"))
    expect(result.current.pubKey).toBe("")
    expect(result.current.username).toBe("satoshin21")
    /** This screen exists to hand support a pubkey; a blank field with no telemetry leaves
     *  nobody able to explain it. */
    expect(mockReportError).toHaveBeenCalledWith(
      "deriveWalletIdentityPubkey",
      expect.objectContaining({ message: "signer unavailable" }),
    )
  })

  /** Unmounting before the phrase resolves must not set state on a gone component, and must
   *  not allocate the two seed-derived native signers for a screen that is already gone. */
  it("skips the derivation and the pubkey update when unmounted before the phrase resolves", async () => {
    let resolvePhrase: (phrase: string) => void = () => {}
    mockLoadMnemonic = () =>
      new Promise((resolve) => {
        resolvePhrase = resolve
      })

    const { result, unmount } = renderHook(() => useMigrationSupportDetails())
    unmount()
    resolvePhrase("abandon ability able")
    await Promise.resolve()

    expect(result.current.pubKey).toBe("")
    expect(mockDerive).not.toHaveBeenCalled()
  })

  it("falls back to empty strings while the data is unavailable", async () => {
    mockMnemonic = ""
    mockUseMigrationSupportDetailsQuery.mockReturnValue({
      loading: true,
      data: undefined,
    })

    const { result } = renderHook(() => useMigrationSupportDetails())

    await waitFor(() => {
      expect(result.current).toEqual({
        accountId: "",
        pubKey: "",
        username: "",
        email: "",
        phone: "",
      })
    })
  })
})
