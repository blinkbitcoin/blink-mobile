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
const mockUseIpCountryCode = jest.fn<string | undefined, [boolean]>(() => mockIpCountry)
jest.mock("@app/hooks/use-device-location", () => ({
  ...jest.requireActual("@app/hooks/use-device-location"),
  useIpCountryCode: (enabled: boolean) => mockUseIpCountryCode(enabled),
}))

let mockActiveAccountType: AccountType | undefined = AccountType.SelfCustodial
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccountType ? { type: mockActiveAccountType } : undefined,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    custodialCreationBlockedCountries: ["CU", "IR"],
    selfCustodialCreationBlockedCountries: ["KP"],
  }),
}))

const mockModal = jest.fn()
jest.mock("@app/components/restricted-region/restricted-region-modal", () => {
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

jest.mock("@app/components/restricted-region/restricted-region-screen", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    RestrictedRegionScreen: () =>
      ReactNs.createElement(RN.Text, { testID: "restricted-screen" }),
  }
})

const Consumer = () => {
  const { isRestrictedRegion, presentRestrictedRegionModal } = useRestrictedRegion()
  return (
    <Pressable testID="present" onPress={presentRestrictedRegionModal}>
      <Text testID="restricted-value">{String(isRestrictedRegion)}</Text>
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
    mockActiveAccountType = AccountType.SelfCustodial
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

  it("blocks a custodial account with the full screen instead of the modal", () => {
    mockActiveAccountType = AccountType.Custodial
    mockIpCountry = "CU"

    const { getByTestId, queryByTestId } = renderWithProvider()

    expect(getByTestId("restricted-screen")).toBeTruthy()
    expect(queryByTestId("restricted-modal")).toBeNull()
  })

  it("evaluates nothing without an active account", () => {
    mockActiveAccountType = undefined
    mockIpCountry = "CU"

    const { getByTestId } = renderWithProvider()

    expect(getByTestId("restricted-value").props.children).toBe("false")
    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
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
    expect(() => fireEvent.press(getByTestId("present"))).not.toThrow()
  })
})
