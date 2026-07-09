import { renderHook } from "@testing-library/react-native"

import { useMigrationSupportDetails } from "@app/screens/account-migration/hooks/use-migration-support-details"

const mockUseMigrationSupportDetailsQuery = jest.fn()
let mockMnemonic = ""

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationSupportDetailsQuery: () => mockUseMigrationSupportDetailsQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => mockMnemonic,
  useWalletIdentity: (mnemonic: string) => (mnemonic ? "02abc123pubkey" : ""),
}))

describe("useMigrationSupportDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMnemonic = "abandon ability able"
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

  it("maps the custodial identity and the derived wallet pubkey", () => {
    const { result } = renderHook(() => useMigrationSupportDetails())

    expect(result.current).toEqual({
      accountId: "18A4242",
      pubKey: "02abc123pubkey",
      username: "satoshin21",
      email: "email@email.com",
      phone: "+1 374 9383 993",
    })
  })

  it("falls back to empty strings while the data is unavailable", () => {
    mockMnemonic = ""
    mockUseMigrationSupportDetailsQuery.mockReturnValue({
      loading: true,
      data: undefined,
    })

    const { result } = renderHook(() => useMigrationSupportDetails())

    expect(result.current).toEqual({
      accountId: "",
      pubKey: "",
      username: "",
      email: "",
      phone: "",
    })
  })
})
