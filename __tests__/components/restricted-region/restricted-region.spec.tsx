import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render } from "@testing-library/react-native"

import {
  RestrictedRegionProvider,
  useRestrictedRegion,
} from "@app/components/restricted-region"
import { AccountType } from "@app/types/wallet"

jest.mock("@app/utils/ip-country-lookup")

let mockIpCountry: string | undefined
let mockIpSettled = true
/** The custodial verdict is the server's now, so the region is driven through the query
 *  the provider reads. `restricted` follows the same list the old lookup was matched
 *  against, which is what these cases are written in terms of. */
const CUSTODIAL_BLOCKED_COUNTRIES = ["CU", "IR"]
const mockUseRegionCheckQuery = jest.fn((_options?: unknown) => ({
  data: {
    regionCheck: {
      countryCode: mockIpCountry,
      custodialCreationAllowed: !CUSTODIAL_BLOCKED_COUNTRIES.includes(
        (mockIpCountry ?? "").toUpperCase(),
      ),
      restricted: CUSTODIAL_BLOCKED_COUNTRIES.includes(
        (mockIpCountry ?? "").toUpperCase(),
      ),
    },
  },
  loading: !mockIpSettled,
}))
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useRegionCheckQuery: (options: unknown) => mockUseRegionCheckQuery(options),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: false }),
}))

let mockActiveAccountType: AccountType | undefined = AccountType.SelfCustodial
let mockRegistryHydrating = false
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccountType ? { type: mockActiveAccountType } : undefined,
    loading: mockRegistryHydrating,
  }),
}))

let mockRemoteConfigReady = true
jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    selfCustodialCreationBlockedCountries: ["KP"],
  }),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

const mockGateHold = jest.fn()
const mockGateRelease = jest.fn()
jest.mock("@app/navigation/boot-splash-gate", () => ({
  bootSplashGate: {
    hold: (maxHoldMs: number) => mockGateHold(maxHoldMs),
    release: () => mockGateRelease(),
    whenReleased: () => Promise.resolve(),
  },
}))

const mockModal = jest.fn()
jest.mock("@app/self-custodial/components/restricted-region-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    RestrictedRegionModal: ({
      isVisible,
      onDismiss,
    }: {
      isVisible: boolean
      onDismiss: () => void
    }) => {
      mockModal()
      if (!isVisible) return null
      return ReactNs.createElement(RN.Text, {
        testID: "restricted-modal",
        onPress: onDismiss,
      })
    },
  }
})

jest.mock("@app/custodial/components/restricted-region-screen", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    RestrictedRegionScreen: () =>
      ReactNs.createElement(RN.Text, { testID: "restricted-screen" }),
  }
})

const Consumer = () => {
  const {
    isRestrictedRegion,
    isRestrictedRegionEvaluationPending,
    presentRestrictedRegionModal,
  } = useRestrictedRegion()
  return (
    <Pressable testID="present" onPress={presentRestrictedRegionModal}>
      <Text testID="restricted-value">{String(isRestrictedRegion)}</Text>
      <Text testID="pending-value">{String(isRestrictedRegionEvaluationPending)}</Text>
    </Pressable>
  )
}

const renderWithProvider = () =>
  render(
    <RestrictedRegionProvider>
      <Consumer />
    </RestrictedRegionProvider>,
  )

describe("RestrictedRegionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIpCountry = undefined
    mockIpSettled = true
    mockActiveAccountType = AccountType.SelfCustodial
    mockRegistryHydrating = false
    mockRemoteConfigReady = true
  })

  it("resolves unrestricted when the session country is clean", () => {
    mockIpCountry = "SV"

    const { getByTestId, queryByTestId } = renderWithProvider()

    expect(getByTestId("restricted-value").props.children).toBe("false")
    expect(queryByTestId("restricted-modal")).toBeNull()
    expect(queryByTestId("restricted-screen")).toBeNull()
  })

  it("reads the self-custodial list for a self-custodial account", () => {
    mockIpCountry = "KP"

    const { getByTestId, queryByTestId } = renderWithProvider()

    expect(getByTestId("restricted-value").props.children).toBe("true")
    expect(getByTestId("restricted-modal")).toBeTruthy()
    expect(queryByTestId("restricted-screen")).toBeNull()
  })

  it("does not restrict a self-custodial account from a custodial-only country", () => {
    mockIpCountry = "CU"

    const { getByTestId } = renderWithProvider()

    expect(getByTestId("restricted-value").props.children).toBe("false")
  })

  it("blocks a custodial account with the full screen while children stay mounted", () => {
    mockActiveAccountType = AccountType.Custodial
    mockIpCountry = "CU"

    const { getByTestId, queryByTestId } = renderWithProvider()

    expect(getByTestId("restricted-screen")).toBeTruthy()
    expect(queryByTestId("restricted-modal")).toBeNull()
    expect(getByTestId("restricted-value")).toBeTruthy()
  })

  it("evaluates nothing without an active account", () => {
    mockActiveAccountType = undefined
    mockIpCountry = "CU"

    const { getByTestId } = renderWithProvider()

    expect(getByTestId("restricted-value").props.children).toBe("false")
    expect(mockUseRegionCheckQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
    expect(mockGateRelease).toHaveBeenCalled()
    expect(mockGateHold).not.toHaveBeenCalled()
  })

  it("holds the splash while the account type is still unknown", () => {
    mockActiveAccountType = undefined
    mockRegistryHydrating = true

    const { getByTestId } = renderWithProvider()

    expect(mockGateHold).toHaveBeenCalledWith(2000)
    expect(mockGateRelease).not.toHaveBeenCalled()
    expect(getByTestId("restricted-value")).toBeTruthy()
  })

  it("holds the splash while a custodial evaluation is pending, children mounted", () => {
    mockActiveAccountType = AccountType.Custodial
    mockIpSettled = false

    const { getByTestId } = renderWithProvider()

    expect(mockGateHold).toHaveBeenCalledWith(2000)
    expect(mockGateRelease).not.toHaveBeenCalled()
    expect(getByTestId("restricted-value")).toBeTruthy()
    expect(getByTestId("pending-value").props.children).toBe("true")
  })

  it("releases the splash for a custodial account before remote config resolves", () => {
    // Its verdict is the server's now, and reads no compiled-in list to wait on.
    mockActiveAccountType = AccountType.Custodial
    mockRemoteConfigReady = false

    renderWithProvider()

    expect(mockGateRelease).toHaveBeenCalled()
  })

  it("holds a self-custodial verdict until its own list has been fetched", () => {
    // A list still in flight would have the verdict read off the compiled-in defaults,
    // so the evaluation stays pending and no consumer may act on it yet.
    mockActiveAccountType = AccountType.SelfCustodial
    mockRemoteConfigReady = false
    mockIpCountry = "KP"

    const { getByTestId } = renderWithProvider()

    expect(getByTestId("pending-value").props.children).toBe("true")
  })

  it("never holds the splash for a known self-custodial account", () => {
    mockIpSettled = false

    const { getByTestId } = renderWithProvider()

    expect(mockGateHold).not.toHaveBeenCalled()
    expect(mockGateRelease).toHaveBeenCalled()
    expect(getByTestId("pending-value").props.children).toBe("true")
  })

  it("releases the splash once the custodial evaluation settles", () => {
    mockActiveAccountType = AccountType.Custodial
    mockIpSettled = false
    const { getByTestId, rerender } = renderWithProvider()

    expect(mockGateRelease).not.toHaveBeenCalled()

    mockIpCountry = "CU"
    mockIpSettled = true
    rerender(
      <RestrictedRegionProvider>
        <Consumer />
      </RestrictedRegionProvider>,
    )

    expect(mockGateRelease).toHaveBeenCalled()
    expect(getByTestId("restricted-screen")).toBeTruthy()
    expect(getByTestId("pending-value").props.children).toBe("false")
  })

  it("presents the modal once per restricted session", () => {
    mockIpCountry = "KP"

    const { getByTestId, queryByTestId } = renderWithProvider()

    fireEvent.press(getByTestId("restricted-modal"))
    expect(queryByTestId("restricted-modal")).toBeNull()

    act(() => {})
    expect(queryByTestId("restricted-modal")).toBeNull()
  })

  it("re-arms the automatic presentation after the region clears", () => {
    mockIpCountry = "KP"
    const { getByTestId, queryByTestId, rerender } = renderWithProvider()

    fireEvent.press(getByTestId("restricted-modal"))

    mockIpCountry = undefined
    rerender(
      <RestrictedRegionProvider>
        <Consumer />
      </RestrictedRegionProvider>,
    )
    expect(queryByTestId("restricted-modal")).toBeNull()

    mockIpCountry = "KP"
    rerender(
      <RestrictedRegionProvider>
        <Consumer />
      </RestrictedRegionProvider>,
    )
    expect(getByTestId("restricted-modal")).toBeTruthy()
  })

  it("reopens the modal from a consumer after a dismiss", () => {
    mockIpCountry = "KP"
    const { getByTestId } = renderWithProvider()

    fireEvent.press(getByTestId("restricted-modal"))
    fireEvent.press(getByTestId("present"))

    expect(getByTestId("restricted-modal")).toBeTruthy()
  })

  it("defaults to a no-op outside the provider", () => {
    const { getByTestId } = render(<Consumer />)

    expect(getByTestId("restricted-value").props.children).toBe("false")
    expect(getByTestId("pending-value").props.children).toBe("false")
    expect(() => fireEvent.press(getByTestId("present"))).not.toThrow()
  })
})
