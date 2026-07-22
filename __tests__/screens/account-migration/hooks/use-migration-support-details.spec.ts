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

jest.mock("@app/self-custodial/bridge", () => ({
  deriveWalletIdentityPubkey: (mnemonic: string) => (mnemonic ? "02abc123pubkey" : ""),
}))

describe("useMigrationSupportDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMnemonic = "abandon ability able"
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

  /** Unmounting before the phrase resolves must not set state on a gone component. */
  it("skips the pubkey update when unmounted before the phrase resolves", async () => {
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
