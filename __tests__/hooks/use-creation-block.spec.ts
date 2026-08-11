import { act, renderHook, waitFor } from "@testing-library/react-native"

import { AccountOption } from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"
import { CreationBlockReason } from "@app/types/account"

const mockUseRemoteConfig = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockResolveIpCountryCodeCached = jest.fn()
const mockUpdateCountryCode = jest.fn()

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({}),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-account-type-options", () => ({
  AccountOption: { Custodial: "custodial", SelfCustodial: "selfCustodial" },
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: () => mockResolveIpCountryCodeCached(),
}))

const setUp = ({
  ipCountryCode,
  accountCount = 1,
  isRegistryHydrating = false,
  custodialCreationBlockedCountries = ["CU", "IR"],
  selfCustodialCreationBlockedCountries = ["KP", "SY"],
  custodialFirstSignupBlockedCountries = [],
}: {
  ipCountryCode?: string
  accountCount?: number
  isRegistryHydrating?: boolean
  custodialCreationBlockedCountries?: string[]
  selfCustodialCreationBlockedCountries?: string[]
  custodialFirstSignupBlockedCountries?: string[]
}) => {
  mockResolveIpCountryCodeCached.mockResolvedValue(ipCountryCode)
  mockUseAccountRegistry.mockReturnValue({
    accounts: new Array(accountCount).fill({}),
    loading: isRegistryHydrating,
  })
  mockUseRemoteConfig.mockReturnValue({
    custodialCreationBlockedCountries,
    selfCustodialCreationBlockedCountries,
    custodialFirstSignupBlockedCountries,
  })
  return renderHook(() => useCreationBlock())
}

/** The check flips isChecking, so it is driven inside act to keep the render tree quiet. */
const check = async (
  result: { current: ReturnType<typeof useCreationBlock> },
  option: AccountOption,
): Promise<CreationBlockReason | null> => {
  let reason: CreationBlockReason | null = null
  await act(async () => {
    reason = await result.current.checkBlockReason(option)
  })
  return reason
}

describe("useCreationBlock", () => {
  beforeEach(() => jest.clearAllMocks())

  it("looks up nothing until an option is submitted", () => {
    setUp({ ipCountryCode: "CU" })

    // Merely opening the screen must not locate anyone.
    expect(mockResolveIpCountryCodeCached).not.toHaveBeenCalled()
  })

  describe("regional rules", () => {
    it("refuses the custodial option from its own list", async () => {
      const { result } = setUp({ ipCountryCode: "CU" })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
    })

    it("refuses the self-custodial option from its own list", async () => {
      const { result } = setUp({ ipCountryCode: "KP" })

      expect(await check(result, AccountOption.SelfCustodial)).toBe(
        CreationBlockReason.Region,
      )
    })

    it("reads each option from its own list, so the lists can diverge", async () => {
      const { result } = setUp({
        ipCountryCode: "CU",
        custodialCreationBlockedCountries: ["CU"],
        selfCustodialCreationBlockedCountries: ["KP"],
      })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
      expect(await check(result, AccountOption.SelfCustodial)).toBeNull()
    })

    it("allows an option whose list does not carry the country", async () => {
      const { result } = setUp({ ipCountryCode: "SV" })

      expect(await check(result, AccountOption.Custodial)).toBeNull()
      expect(await check(result, AccountOption.SelfCustodial)).toBeNull()
    })

    it("matches case-insensitively", async () => {
      const { result } = setUp({
        ipCountryCode: "cu",
        custodialCreationBlockedCountries: ["CU"],
      })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
    })
  })

  describe("the first custodial signup", () => {
    it("is refused in a listed country when the device holds no account", async () => {
      const { result } = setUp({
        ipCountryCode: "PK",
        accountCount: 0,
        custodialFirstSignupBlockedCountries: ["PK"],
      })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.FirstCustodialSignup,
      )
    })

    it("is allowed in that same country once an account exists", async () => {
      const { result } = setUp({
        ipCountryCode: "PK",
        accountCount: 1,
        custodialFirstSignupBlockedCountries: ["PK"],
      })

      // The rule only ever refuses a user's very first Blink account.
      expect(await check(result, AccountOption.Custodial)).toBeNull()
    })

    it("never refuses the self-custodial option, which the rule does not govern", async () => {
      const { result } = setUp({
        ipCountryCode: "PK",
        accountCount: 0,
        custodialFirstSignupBlockedCountries: ["PK"],
      })

      expect(await check(result, AccountOption.SelfCustodial)).toBeNull()
    })

    it("yields to the regional rule, which is the stronger refusal", async () => {
      const { result } = setUp({
        ipCountryCode: "CU",
        accountCount: 0,
        custodialCreationBlockedCountries: ["CU"],
        custodialFirstSignupBlockedCountries: ["CU"],
      })

      // Offering self-custodial instead would be wrong where no account may be created.
      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
    })
  })

  describe("the country it reads", () => {
    it("uppercases what the provider returned before matching any list", async () => {
      const { result } = setUp({
        ipCountryCode: "pk",
        accountCount: 0,
        custodialFirstSignupBlockedCountries: ["PK"],
      })

      // The lists are stored uppercase, so a lowercase answer must not slip past them.
      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.FirstCustodialSignup,
      )
    })

    it("records the answer, so the rest of the app shares the country it read", async () => {
      const { result } = setUp({ ipCountryCode: "SV" })

      await check(result, AccountOption.Custodial)

      expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "SV")
    })

    it("reports an unreadable location as such, rather than blaming the region", async () => {
      const { result } = setUp({ ipCountryCode: undefined, accountCount: 5 })

      // Someone who already holds accounts is not refused for a first signup.
      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.UnknownRegion,
      )
      expect(await check(result, AccountOption.SelfCustodial)).toBe(
        CreationBlockReason.UnknownRegion,
      )
    })

    it("reads the connection and never an account's registered phone", async () => {
      const { result } = setUp({ ipCountryCode: "CU" })

      // Which account happens to be open must not decide who may create a new one.
      await check(result, AccountOption.Custodial)

      expect(mockResolveIpCountryCodeCached).toHaveBeenCalled()
    })
  })

  describe("the flags a submit button waits on", () => {
    const setUpPending = () => {
      let resolveLookup: (code: string) => void = () => undefined
      mockResolveIpCountryCodeCached.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveLookup = resolve
        }),
      )
      mockUseAccountRegistry.mockReturnValue({ accounts: [], loading: false })
      mockUseRemoteConfig.mockReturnValue({
        custodialCreationBlockedCountries: [],
        selfCustodialCreationBlockedCountries: [],
        custodialFirstSignupBlockedCountries: [],
      })
      return {
        render: renderHook(() => useCreationBlock()),
        resolve: () => resolveLookup("SV"),
      }
    }

    it("holds while the connection is being read and settles after", async () => {
      const { render: rendered, resolve } = setUpPending()
      const { result } = rendered
      expect(result.current.isChecking).toBe(false)

      let pending: Promise<CreationBlockReason | null> = Promise.resolve(null)
      act(() => {
        pending = result.current.checkBlockReason(AccountOption.SelfCustodial)
      })
      await waitFor(() => expect(result.current.isChecking).toBe(true))

      await act(async () => {
        resolve()
        await pending
      })

      expect(result.current.isChecking).toBe(false)
    })

    it("reports the first-signup rule unready while the account registry hydrates", () => {
      const { result } = setUp({ ipCountryCode: "SV", isRegistryHydrating: true })

      // An empty registry mid-hydration would refuse a device that already holds accounts.
      expect(result.current.isFirstSignupRuleReady).toBe(false)
      // Nobody asked for a check, so nothing is in flight either.
      expect(result.current.isChecking).toBe(false)
    })

    it("reports the rule ready once the registry has settled", () => {
      const { result } = setUp({ ipCountryCode: "SV" })

      expect(result.current.isFirstSignupRuleReady).toBe(true)
    })
  })
})
