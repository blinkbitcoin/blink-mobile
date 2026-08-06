import { CountryCode } from "libphonenumber-js/mobile"
import * as React from "react"
// eslint-disable-next-line react-native/split-platform-components
import { Alert, Dimensions, View, ActivityIndicator } from "react-native"
import { Region } from "react-native-maps"
import { check, PermissionStatus, RESULTS } from "react-native-permissions"

import MapComponent from "@app/components/map-components"
import { MapMarker, useRegionQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import Geolocation from "@react-native-community/geolocation"
import { useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import countryCodes from "../../../utils/countryInfo.json"
import { Screen } from "@app/components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { toastShow } from "../../utils/toast"
import { IMarker } from "./btc-map-interface"
import { LOCATION_PERMISSION, getUserRegion } from "./functions"
import { useCallback, useMemo } from "react"
import { Place } from "@app/components/map-components/map-types"
import { usePlacesData } from "@app/components/map-components/map-hooks/use-places-data"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { makeStyles } from "@rn-vui/themed"

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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Primary">
}

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  enableBackgroundLocationUpdates: false,
  authorizationLevel: "whenInUse",
  locationProvider: "auto",
})

const transformPlacesToMarkers = (places: Place[]): IMarker[] => {
  return places
    .filter((p) => p && typeof p.lat === "number" && typeof p.lon === "number")
    .map(({ lon, lat, id, icon, name, category }) => ({
      id,
      icon,
      name: name ?? null,
      category: category ?? null,
      location: {
        latitude: lat,
        longitude: lon,
      },
      tags: {},
    }))
}

export const MapScreen: React.FC<Props> = ({ navigation }) => {
  const isAuthed = useIsAuthed()
  const { isSelfCustodial } = useActiveWallet()
  const { countryCode, loading } = useDeviceLocation()
  const { data: lastRegion, error: lastRegionError } = useRegionQuery()
  const { LL } = useI18nContext()

  const styles = useStyles()

  const { places, error, isLoading } = usePlacesData()

  const [initialLocation, setInitialLocation] = React.useState<Region>()
  const [isInitializing, setInitializing] = React.useState(true)
  const [permissionsStatus, setPermissionsStatus] = React.useState<PermissionStatus>()

  const showError = useCallback(
    (errorMessage: string) => {
      toastShow({ message: errorMessage, LL })
    },
    [LL],
  )

  React.useEffect(() => {
    if (error) {
      showError(error)
    }
  }, [error, showError])

  // Initialization: load fonts + check GPS permission
  React.useEffect(() => {
    let isMounted = true
    const loadResources = async () => {
      try {
        await MaterialIcons.loadFont()
        console.log("loaded")
      } catch (err) {
        console.warn("Failed to load font:", err)
      }

      if (!isMounted) return

      // Check (NOT request) if location permissions are given
      const status = await check(LOCATION_PERMISSION)
      if (!isMounted) return
      setPermissionsStatus(status)

      if (status === RESULTS.GRANTED) {
        getUserRegion((region) => {
          if (!isMounted) return
          if (region) {
            setInitialLocation(region)
          }
          setInitializing(false)
        })
      } else {
        setInitializing(false)
      }
    }
    loadResources()
    return () => {
      isMounted = false
    }
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
    if (countryCode && lastRegion && !isInitializing && !loading && !initialLocation) {
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
        const countryCoords: { lat: number; lng: number } =
          countryCodesToCoords.data[countryCode]
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

  const handleCalloutPress = (item: MapMarker) => {
    if (isAuthed || isSelfCustodial) {
      navigation.navigate("sendBitcoinDestination", { username: item.username })
    } else {
      navigation.navigate("acceptTermsAndConditions", { flow: "phone" })
    }
  }

  const formattedData = useMemo<IMarker[]>(() => {
    if (!places?.baseData) return []
    return transformPlacesToMarkers(places.baseData)
  }, [places?.baseData])

  console.log("[map-screen] isInitializing:", isInitializing, "initialLocation:", !!initialLocation, "data:", formattedData.length, "isLoading:", isLoading, "error:", error)

  if (isInitializing || !initialLocation) {
    return (
      <Screen>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </Screen>
    )
  }
  return (
    <Screen preset="fixed" unsafe>
      {initialLocation && (
        <MapComponent
          data={formattedData}
          userLocation={initialLocation}
          handlePayButton={handlePayButton}
          hasLocation={permissionsStatus === RESULTS.GRANTED}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  loadingState: { flex: 1, justifyContent: "center", alignItems: "center" },
}))
