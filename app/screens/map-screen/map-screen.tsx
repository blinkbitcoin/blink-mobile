import { CountryCode } from "libphonenumber-js/mobile"
import * as React from "react"
// eslint-disable-next-line react-native/split-platform-components
import { Alert, Dimensions } from "react-native"
import { Region } from "react-native-maps"
import { check, PermissionStatus, RESULTS } from "react-native-permissions"

import { LatLng } from "@app/btcmap"
import MapComponent from "@app/components/map-component"
import { useRegionQuery } from "@app/graphql/generated"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import Geolocation from "@react-native-community/geolocation"

import countryCodes from "../../../utils/countryInfo.json"
import { Screen } from "../../components/screen"
import { LOCATION_PERMISSION, getUserRegion } from "./functions"

const EL_ZONTE_COORDS = {
  latitude: 13.496743,
  longitude: -89.439462,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

// essentially calculates zoom for location being set based on country
const { height, width } = Dimensions.get("window")
const LATITUDE_DELTA = 15 // <-- decrease for more zoom
const LONGITUDE_DELTA = LATITUDE_DELTA * (width / height)

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  enableBackgroundLocationUpdates: false,
  authorizationLevel: "whenInUse",
  locationProvider: "auto",
})

/**
 * Merchants that take bitcoin, from BTC Map (https://btcmap.org) — the
 * community-maintained OpenStreetMap overlay the wider bitcoin ecosystem
 * already uses. We read it; nothing here writes back to it.
 */
export const MapScreen: React.FC = () => {
  const { countryCode, loading } = useDeviceLocation()
  const { data: lastRegion, error: lastRegionError } = useRegionQuery()
  const { LL } = useI18nContext()

  const [initialLocation, setInitialLocation] = React.useState<Region>()
  const [userCoords, setUserCoords] = React.useState<LatLng>()
  const [isInitializing, setInitializing] = React.useState(true)
  const [permissionsStatus, setPermissionsStatus] = React.useState<PermissionStatus>()

  // On screen load, check (NOT request) if location permissions are given
  React.useEffect(() => {
    ;(async () => {
      const status = await check(LOCATION_PERMISSION)
      setPermissionsStatus(status)
      if (status === RESULTS.GRANTED) {
        getUserRegion(async (region) => {
          if (region) {
            setInitialLocation(region)
            setUserCoords({ latitude: region.latitude, longitude: region.longitude })
          } else {
            setInitializing(false)
          }
        })
      } else {
        setInitializing(false)
      }
    })()
  }, [])

  const alertOnLocationError = React.useCallback(() => {
    Alert.alert(LL.common.error(), LL.MapScreen.error())
  }, [LL])

  React.useEffect(() => {
    if (lastRegionError) {
      setInitializing(false)
      setInitialLocation(EL_ZONTE_COORDS)
      alertOnLocationError()
    }
  }, [lastRegionError, alertOnLocationError])

  // Flow when location permissions are denied
  React.useEffect(() => {
    if (lastRegion && !isInitializing && !loading && !initialLocation) {
      // User has used map before, so we use their last viewed coords
      if (lastRegion.region) {
        const { latitude, longitude, latitudeDelta, longitudeDelta } = lastRegion.region
        const region: Region = {
          latitude,
          longitude,
          latitudeDelta,
          longitudeDelta,
        }
        setInitialLocation(region)
        // User is using maps for the first time, so we center on the center of their IP's country
      } else {
        // JSON 'hashmap' with every countrys' code listed with their lat and lng
        const countryCodesToCoords: {
          data: Record<CountryCode, { lat: number; lng: number }>
        } = JSON.parse(JSON.stringify(countryCodes))
        /** No resolved country (e.g. Anon Mode) falls through to the default coords. */
        const countryCoords: { lat: number; lng: number } | undefined = countryCode
          ? countryCodesToCoords.data[countryCode]
          : undefined
        if (countryCoords) {
          const region: Region = {
            latitude: countryCoords.lat,
            longitude: countryCoords.lng,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }
          setInitialLocation(region)
          // backup if country code is not recognized
        } else {
          setInitialLocation(EL_ZONTE_COORDS)
        }
      }
    }
  }, [isInitializing, countryCode, lastRegion, loading, initialLocation])

  return (
    <Screen edges={["left", "right"]}>
      {initialLocation && (
        <MapComponent
          userLocation={initialLocation}
          userCoords={userCoords}
          permissionsStatus={permissionsStatus}
          setPermissionsStatus={setPermissionsStatus}
          alertOnLocationError={alertOnLocationError}
        />
      )}
    </Screen>
  )
}
