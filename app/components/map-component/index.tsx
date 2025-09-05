import debounce from "lodash.debounce"
import React, { useRef } from "react"
import { View } from "react-native"
import MapView, { MapMarker as MapMarkerType, Region } from "react-native-maps"
import { PermissionStatus, RESULTS, request } from "react-native-permissions"

import { useApolloClient } from "@apollo/client"
import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { BusinessMapMarkersQuery, MapMarker } from "@app/graphql/generated"
import { LOCATION_PERMISSION, getUserRegion } from "@app/screens/map-screen/functions"
import { isIOS } from "@rn-vui/base"
import { makeStyles, useTheme } from "@rn-vui/themed"

import MapMarkerComponent from "../map-marker-component"
import LocationButtonCopy from "./location-button-copy"
import MapStyles from "./map-styles.json"
import { OpenSettingsElement, OpenSettingsModal } from "./open-settings-modal"

type Props = {
  data?: BusinessMapMarkersQuery
  userLocation?: Region
  permissionsStatus?: PermissionStatus
  setPermissionsStatus: (_: PermissionStatus) => void
  handleMapPress: () => void
  handleMarkerPress: (_: MapMarker) => void
  focusedMarker: MapMarker | null
  focusedMarkerRef: React.MutableRefObject<MapMarkerType | null>
  handleCalloutPress: (_: MapMarker) => void
  alertOnLocationError: () => void
}

export default function MapComponent({
  data,
  userLocation,
  permissionsStatus,
  setPermissionsStatus,
  handleMapPress,
  handleMarkerPress,
  focusedMarker,
  focusedMarkerRef,
  handleCalloutPress,
  alertOnLocationError,
}: Props) {
  const {
    theme: { colors, mode: themeMode },
  } = useTheme()
  const styles = useStyles()
  const client = useApolloClient()

  const mapViewRef = useRef<MapView>(null)
  const openSettingsModalRef = React.useRef<OpenSettingsElement>(null)
  const isAndroidSecondPermissionRequest = React.useRef(false)

  // toggle modal from inside modal component instead of here in the parent
  const toggleModal = React.useCallback(
    () => openSettingsModalRef.current?.toggleVisibility(),
    [],
  )

  const respondToBlocked = (status: PermissionStatus) => {
    // iOS will only ever ask once for permission, and initial checks can differentiate between BLOCKED vs DENIED
    if (isIOS) {
      if (permissionsStatus === RESULTS.BLOCKED && status === RESULTS.BLOCKED) {
        toggleModal()
      }
      // Android can ask twice for permission, and initial checks cannot differentiate between BLOCKED vs DENIED
    } else {
      !isAndroidSecondPermissionRequest.current && toggleModal()
    }
  }

  const centerOnUser = async () => {
    getUserRegion(async (region) => {
      if (region && mapViewRef.current) {
        mapViewRef.current.animateToRegion(region)
      } else {
        alertOnLocationError()
      }
    })
  }

  const requestLocationPermission = async () => {
    try {
      const status = await request(
        LOCATION_PERMISSION,
        () =>
          new Promise((resolve) => {
            // This will only trigger on Android if it's the 2nd request ever
            isAndroidSecondPermissionRequest.current = true
            resolve(true)
          }),
      )
      if (status === RESULTS.GRANTED) {
        centerOnUser()
      } else if (status === RESULTS.BLOCKED) {
        respondToBlocked(status)
      }
      isAndroidSecondPermissionRequest.current = false
      setPermissionsStatus(status)
    } catch {
      alertOnLocationError()
    }
  }

  const debouncedHandleRegionChange = React.useRef(
    debounce((region: Region) => updateMapLastCoords(client, region), 1000, {
      trailing: true,
    }),
  ).current

  return (
    <View style={styles.viewContainer}>
      <MapView
        ref={mapViewRef}
        style={styles.map}
        showsUserLocation={permissionsStatus === RESULTS.GRANTED}
        showsMyLocationButton={false}
        initialRegion={userLocation}
        customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light}
        onPress={handleMapPress}
        onRegionChange={debouncedHandleRegionChange}
        onMarkerSelect={(e) => {
          // react-native-maps has a very annoying error on iOS
          // When two markers are almost on top of each other onSelect will get called for a nearby Marker
          // This improvement (not an optimal fix) checks to see if that error happened, and quickly reopens the correct callout
          const matchingLat =
            e.nativeEvent.coordinate.latitude ===
            focusedMarker?.mapInfo.coordinates.latitude
          const matchingLng =
            e.nativeEvent.coordinate.longitude ===
            focusedMarker?.mapInfo.coordinates.longitude
          if (!matchingLat || !matchingLng) {
            if (focusedMarkerRef.current) {
              focusedMarkerRef.current.showCallout()
            }
          }
        }}
      >
        {(data?.businessMapMarkers ?? []).map((item: MapMarker) => (
          <MapMarkerComponent
            key={item.username}
            item={item}
            color={colors._orange}
            handleCalloutPress={handleCalloutPress}
            handleMarkerPress={handleMarkerPress}
            isFocused={focusedMarker?.username === item.username}
          />
        ))}
      </MapView>
      {permissionsStatus !== RESULTS.UNAVAILABLE &&
        permissionsStatus !== RESULTS.LIMITED && (
          <LocationButtonCopy
            requestPermissions={requestLocationPermission}
            permissionStatus={permissionsStatus}
            centerOnUser={centerOnUser}
          />
        )}
      <OpenSettingsModal ref={openSettingsModalRef} />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  map: {
    height: "100%",
    width: "100%",
  },

  viewContainer: { flex: 1 },
}))
