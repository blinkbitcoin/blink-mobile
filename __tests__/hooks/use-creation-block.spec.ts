import { act, renderHook, waitFor } from "@testing-library/react-native"

import { AccountOption } from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"
import { CreationBlockReason } from "@app/types/account"

const mockUseRemoteConfig = jest.fn()
const mockUsePhoneCountryCode = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockResolveIpCountryCodeCached = jest.fn()
const mockUpdateCountryCode = jest.fn()
const mockUseCountryCodeQuery = jest.fn()

jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({}),
}))

jest.mock("@app/graphql/generated", () => ({
  useCountryCodeQuery: () => mockUseCountryCodeQuery(),
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

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  usePhoneCountryCode: (options?: unknown) => mockUsePhoneCountryCode(options),
}))

jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: () => mockResolveIpCountryCodeCached(),
}))

const setUp = ({
  ipCountryCode,
  phoneCountryCode = undefined,
  accountCount = 1,
  isRegistryHydrating = false,
  cachedCountryCode = undefined,
  custodialCreationBlockedCountries = ["CU", "IR"],
  selfCustodialCreationBlockedCountries = ["KP", "SY"],
  custodialFirstSignupBlockedCountries = [],
}: {
  ipCountryCode?: string
  phoneCountryCode?: string
  accountCount?: number
  isRegistryHydrating?: boolean
  cachedCountryCode?: string
  custodialCreationBlockedCountries?: string[]
  selfCustodialCreationBlockedCountries?: string[]
  custodialFirstSignupBlockedCountries?: string[]
}) => {
  mockUsePhoneCountryCode.mockReturnValue(phoneCountryCode)
  mockResolveIpCountryCodeCached.mockResolvedValue(ipCountryCode)
  mockUseCountryCodeQuery.mockReturnValue({ data: { countryCode: cachedCountryCode } })
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
    it("prefers a phone already in hand over reading the connection", async () => {
      const { result } = setUp({
        ipCountryCode: "SV",
        phoneCountryCode: "CU",
        custodialCreationBlockedCountries: ["CU"],
      })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
      expect(mockResolveIpCountryCodeCached).not.toHaveBeenCalled()
    })

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

    it("keeps a country read earlier when the lookup is down", async () => {
      const { result } = setUp({
        ipCountryCode: undefined,
        cachedCountryCode: "CU",
      })

      expect(await check(result, AccountOption.Custodial)).toBe(
        CreationBlockReason.Region,
      )
    })

    it("records a fresh answer so a later check can fall back to it", async () => {
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

    it("falls back to the connection when no phone is registered", async () => {
      const { result } = setUp({ ipCountryCode: "CU" })

      await check(result, AccountOption.Custodial)

      expect(mockResolveIpCountryCodeCached).toHaveBeenCalled()
    })
  })

  describe("isChecking", () => {
    const setUpPending = () => {
      let resolveLookup: (code: string) => void = () => undefined
      mockUsePhoneCountryCode.mockReturnValue(undefined)
      mockResolveIpCountryCodeCached.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveLookup = resolve
        }),
      )
      mockUseCountryCodeQuery.mockReturnValue({ data: { countryCode: undefined } })
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

    it("stays held until the last of several checks settles", async () => {
      const { render: rendered, resolve } = setUpPending()
      const { result } = rendered

      let first: Promise<CreationBlockReason | null> = Promise.resolve(null)
      let second: Promise<CreationBlockReason | null> = Promise.resolve(null)
      act(() => {
        first = result.current.checkBlockReason(AccountOption.SelfCustodial)
        second = result.current.checkBlockReason(AccountOption.Custodial)
      })
      await waitFor(() => expect(result.current.isChecking).toBe(true))

      await act(async () => {
        resolve()
        await first
      })

      // A screen submits every option at once, so one finishing cannot free the button.
      await act(async () => {
        await second
      })
      expect(result.current.isChecking).toBe(false)
    })

    it("holds while the account registry is still hydrating", () => {
      const { result } = setUp({ ipCountryCode: "SV", isRegistryHydrating: true })

      // The account count decides the first-signup rule, so it cannot answer yet.
      expect(result.current.isChecking).toBe(true)
    })
  })
})
