import { renderHook, act } from "@testing-library/react-native"

import {
  AccountStatus,
  AccountType,
  CUSTODIAL_DEFAULT_ID,
  SELF_CUSTODIAL_DEFAULT_ID,
} from "@app/types/wallet.types"

import {
  createCustodialDescriptor,
  createSelfCustodialDescriptor,
  markSelected,
  useAccountRegistry,
} from "@app/hooks/use-account-registry"

const mockUseIsAuthed = jest.fn()
const mockUpdateState = jest.fn()
const mockSaveToken = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        custodialLabel: () => "Blink",
        selfCustodialLabel: () => "Spark",
      },
    },
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled,
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { activeAccountId: mockActiveAccountId, galoyAuthToken: "token" },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    saveToken: mockSaveToken,
    appConfig: { token: "token", galoyInstance: { id: "Main" } },
  }),
}))

let mockNonCustodialEnabled = false
let mockActiveAccountId: string | undefined

describe("useAccountRegistry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNonCustodialEnabled = false
    mockActiveAccountId = undefined
  })

  it("returns custodial account when authenticated", () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())

    expect(result.current.accounts).toHaveLength(1)
    expect(result.current.accounts[0].type).toBe(AccountType.Custodial)
    expect(result.current.accounts[0].label).toBe("Blink")
    expect(result.current.accounts[0].status).toBe(AccountStatus.Available)
  })

  it("returns empty accounts when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)

    const { result } = renderHook(() => useAccountRegistry())

    expect(result.current.accounts).toHaveLength(0)
    expect(result.current.activeAccount).toBeUndefined()
  })

  it("includes self-custodial account when flag enabled", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockNonCustodialEnabled = true

    const { result } = renderHook(() => useAccountRegistry())

    expect(result.current.accounts).toHaveLength(2)
    expect(result.current.accounts[1].type).toBe(AccountType.SelfCustodial)
    expect(result.current.accounts[1].label).toBe("Spark")
    expect(result.current.accounts[1].status).toBe(AccountStatus.RequiresRestore)
  })

  it("selects first account by default when no activeAccountId", () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())

    expect(result.current.activeAccount?.id).toBe("custodial-default")
    expect(result.current.activeAccount?.selected).toBe(true)
  })

  it("selects account matching activeAccountId", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockNonCustodialEnabled = true
    mockActiveAccountId = "self-custodial-default"

    const { result } = renderHook(() => useAccountRegistry())

    expect(result.current.activeAccount?.id).toBe("self-custodial-default")
    expect(result.current.activeAccount?.type).toBe(AccountType.SelfCustodial)
  })

  it("setActiveAccountId calls updateState", () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())

    act(() => {
      result.current.setActiveAccountId("custodial-default")
    })

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })

  it("setActiveAccountId calls saveToken when switching to custodial", () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())

    act(() => {
      result.current.setActiveAccountId("custodial-default")
    })

    expect(mockSaveToken).toHaveBeenCalledWith("token")
  })

  it("setActiveAccountId does not call saveToken for self-custodial", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockNonCustodialEnabled = true

    const { result } = renderHook(() => useAccountRegistry())

    act(() => {
      result.current.setActiveAccountId("self-custodial-default")
    })

    expect(mockSaveToken).not.toHaveBeenCalled()
  })
})

describe("createCustodialDescriptor", () => {
  it("creates a custodial descriptor with correct defaults", () => {
    const desc = createCustodialDescriptor("Blink")

    expect(desc.id).toBe(CUSTODIAL_DEFAULT_ID)
    expect(desc.type).toBe(AccountType.Custodial)
    expect(desc.label).toBe("Blink")
    expect(desc.selected).toBe(false)
    expect(desc.status).toBe(AccountStatus.Available)
  })
})

describe("createSelfCustodialDescriptor", () => {
  it("creates a self-custodial descriptor with correct defaults", () => {
    const desc = createSelfCustodialDescriptor("Spark")

    expect(desc.id).toBe(SELF_CUSTODIAL_DEFAULT_ID)
    expect(desc.type).toBe(AccountType.SelfCustodial)
    expect(desc.label).toBe("Spark")
    expect(desc.selected).toBe(false)
    expect(desc.status).toBe(AccountStatus.RequiresRestore)
  })
})

describe("markSelected", () => {
  const accounts = [
    createCustodialDescriptor("Blink"),
    createSelfCustodialDescriptor("Spark"),
  ]

  it("marks account matching activeId as selected", () => {
    const result = markSelected(accounts, SELF_CUSTODIAL_DEFAULT_ID)

    expect(result[0].selected).toBe(false)
    expect(result[1].selected).toBe(true)
  })

  it("selects first account when activeId is undefined", () => {
    const result = markSelected(accounts, undefined)

    expect(result[0].selected).toBe(true)
    expect(result[1].selected).toBe(false)
  })

  it("selects none when list is empty", () => {
    const result = markSelected([], "some-id")

    expect(result).toHaveLength(0)
  })
})
