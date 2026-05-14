import React from "react"
import { render, waitFor } from "@testing-library/react-native"

import { MapScreen } from "@app/screens/map-screen/map-screen"
import { PermissionStatus, RESULTS } from "react-native-permissions"

const mockNavigate = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockUseActiveWallet = jest.fn()

let capturedHandleCalloutPress:
  | ((item: {
      username: string
      mapInfo: { coordinates: { latitude: number; longitude: number }; title: string }
    }) => void)
  | undefined

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: "SV", loading: false }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { error: () => "Error" },
      MapScreen: { error: () => "Map error", title: () => "Map" },
    },
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  useBusinessMapMarkersQuery: () => ({
    data: undefined,
    error: undefined,
    refetch: jest.fn(),
  }),
  useRegionQuery: () => ({
    data: {
      region: {
        latitude: 13.5,
        longitude: -89.4,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
    },
    error: undefined,
  }),
}))

jest.mock("@apollo/client", () => ({
  gql: jest.fn(),
}))

jest.mock("@react-native-community/geolocation", () => ({
  setRNConfiguration: jest.fn(),
}))

jest.mock("react-native-permissions", () => ({
  check: jest.fn().mockResolvedValue("denied"),
  request: jest.fn(),
  PermissionStatus: {} as PermissionStatus,
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    BLOCKED: "blocked",
    UNAVAILABLE: "unavailable",
    LIMITED: "limited",
  } as typeof RESULTS,
}))

jest.mock("@app/screens/map-screen/functions", () => ({
  LOCATION_PERMISSION: "LOCATION",
  getUserRegion: jest.fn(),
}))

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return {
    Screen: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(RN.View, null, children),
  }
})

jest.mock("@app/components/map-component", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      capturedHandleCalloutPress =
        props.handleCalloutPress as typeof capturedHandleCalloutPress
      return ReactActual.createElement(RN.View, { testID: "map-component" })
    },
  }
})

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

const baseItem = {
  __typename: "MapMarker" as const,
  username: "isacorlando",
  mapInfo: {
    __typename: "MapInfo" as const,
    title: "Isac Orlando",
    coordinates: {
      __typename: "Coordinates" as const,
      latitude: 13.5,
      longitude: -89.4,
    },
  },
}

const renderMapScreen = () =>
  render(<MapScreen navigation={{ navigate: mockNavigate } as never} />)

const waitForCalloutHandler = () =>
  waitFor(() => {
    if (!capturedHandleCalloutPress) {
      throw new Error("MapComponent not yet mounted")
    }
  })

describe("MapScreen.handleCalloutPress", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedHandleCalloutPress = undefined
  })

  it("navigates to sendBitcoinDestination for a custodial authed user", async () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    renderMapScreen()
    await waitForCalloutHandler()
    capturedHandleCalloutPress?.(baseItem)

    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      username: "isacorlando",
    })
  })

  it("navigates to sendBitcoinDestination for a self-custodial user (no Galoy auth)", async () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })

    renderMapScreen()
    await waitForCalloutHandler()
    capturedHandleCalloutPress?.(baseItem)

    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      username: "isacorlando",
    })
  })

  it("navigates to acceptTermsAndConditions for a user with no wallet", async () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    renderMapScreen()
    await waitForCalloutHandler()
    capturedHandleCalloutPress?.(baseItem)

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "phone",
    })
  })

  it("does not call navigate before the callout is pressed", async () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    renderMapScreen()
    await waitForCalloutHandler()

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
