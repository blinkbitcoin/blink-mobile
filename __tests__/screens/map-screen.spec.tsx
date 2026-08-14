import React from "react"
import { render, waitFor } from "@testing-library/react-native"

import { MapScreen } from "@app/screens/map-screen/map-screen"
import { getUserRegion } from "@app/screens/map-screen/functions"
import { check, PermissionStatus, RESULTS } from "react-native-permissions"

let capturedMapProps: Record<string, unknown> | undefined
let capturedScreenProps: Record<string, unknown> | undefined

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
    Screen: ({ children, ...props }: { children?: React.ReactNode }) => {
      capturedScreenProps = props
      return ReactActual.createElement(RN.View, null, children)
    },
  }
})

jest.mock("@app/components/map-component", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      capturedMapProps = props
      return ReactActual.createElement(RN.View, { testID: "map-component" })
    },
  }
})

const mockedCheck = check as jest.MockedFunction<typeof check>
const mockedGetUserRegion = getUserRegion as jest.MockedFunction<typeof getUserRegion>

const waitForMap = () =>
  waitFor(() => {
    if (!capturedMapProps) throw new Error("MapComponent not yet mounted")
  })

describe("MapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedMapProps = undefined
    capturedScreenProps = undefined
    mockedCheck.mockResolvedValue(RESULTS.DENIED)
  })

  it("excludes the bottom safe-area edge the tab bar already reserves", async () => {
    render(<MapScreen />)
    await waitForMap()

    expect(capturedScreenProps?.edges).toEqual(["left", "right"])
  })

  it("falls back to the last viewed region when location is denied", async () => {
    render(<MapScreen />)
    await waitForMap()

    expect(capturedMapProps?.userLocation).toEqual({
      latitude: 13.5,
      longitude: -89.4,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    })
  })

  it("withholds the user's coordinates when location was never granted", async () => {
    // The place sheet only trusts the device clock for nearby places, so an
    // absent fix has to stay absent rather than default to the map centre.
    render(<MapScreen />)
    await waitForMap()

    expect(capturedMapProps?.userCoords).toBeUndefined()
    expect(capturedMapProps?.permissionsStatus).toBe(RESULTS.DENIED)
  })

  it("passes the real fix through once location is granted", async () => {
    mockedCheck.mockResolvedValue(RESULTS.GRANTED)
    mockedGetUserRegion.mockImplementation((callback) =>
      callback({
        latitude: 51.5,
        longitude: -0.12,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }),
    )

    render(<MapScreen />)
    await waitForMap()

    expect(capturedMapProps?.userCoords).toEqual({ latitude: 51.5, longitude: -0.12 })
  })
})
