import debounce from "lodash.debounce"
import React from "react"
import { ActivityIndicator, LayoutChangeEvent, Pressable, View } from "react-native"
import MapView, { Region } from "react-native-maps"
import { PermissionStatus, RESULTS, request } from "react-native-permissions"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useApolloClient } from "@apollo/client"
import {
  BtcMapPlace,
  LatLng,
  PlaceCategory,
  placesInCategories,
  useBtcMapPlaceNames,
  useBtcMapPlaces,
} from "@app/btcmap"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { useI18nContext } from "@app/i18n/i18n-react"
import { LOCATION_PERMISSION, getUserRegion } from "@app/screens/map-screen/functions"
import { useFocusEffect } from "@react-navigation/native"
import { isIOS } from "@rn-vui/base"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { CategoryFilterSheet } from "./category-filter-sheet"
import { ClusterMarker, ClusterMarkerData } from "./cluster-marker"
import { Viewport, placeLabels } from "./label-collision"
import LocationButtonCopy from "./location-button-copy"
import { MapSearchBar, searchBarBottom } from "./map-search-bar"
import MapStyles from "./map-styles.json"
import { OpenSettingsElement, OpenSettingsModal } from "./open-settings-modal"
import { truncateLabel } from "./marker-layout"
import { PlaceLabelMarker } from "./place-label-marker"
import { PlaceMarker } from "./place-marker"
import { PlaceSearchModal } from "./place-search-modal"
import { PlaceSheet } from "./place-sheet"
import { usePlaceClusters } from "./use-place-clusters"
import { longitudeDeltaForZoom, radiusKmForRegion, zoomForRegion } from "./viewport"

// btcmap.org starts labelling its pins here too. Below it the pins are packed
// tightly enough that names would overlap into noise.
const LABEL_MIN_ZOOM = 15

// Close enough that the pin is drawn on its own rather than swallowed by a
// cluster — see CLUSTERING_DISABLED_ZOOM.
const SEARCH_RESULT_ZOOM = 17

// Nothing is labelled before the map has been laid out once, which is a frame.
const EMPTY_LABELS: ReadonlySet<number> = new Set()

const SAVE_COORDS_DEBOUNCE_MS = 1000
const FLY_TO_DURATION_MS = 350

type Props = {
  userLocation: Region
  userCoords?: LatLng
  permissionsStatus?: PermissionStatus
  setPermissionsStatus: (_: PermissionStatus) => void
  alertOnLocationError: () => void
}

export default function MapComponent({
  userLocation,
  userCoords,
  permissionsStatus,
  setPermissionsStatus,
  alertOnLocationError,
}: Props) {
  const {
    theme: { colors, mode: themeMode },
  } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ topInset: insets.top })
  const client = useApolloClient()
  const { LL } = useI18nContext()

  const mapViewRef = React.useRef<MapView>(null)
  const openSettingsModalRef = React.useRef<OpenSettingsElement>(null)
  const isAndroidSecondPermissionRequest = React.useRef(false)

  const [region, setRegion] = React.useState<Region>(userLocation)
  // Seeded from the screen's mount-time fix, then kept current by every
  // successful re-centre — granting permission from here has to start the
  // opening-hours badge working without an app restart.
  const [coords, setCoords] = React.useState<LatLng | undefined>(userCoords)
  const [selectedPlace, setSelectedPlace] = React.useState<BtcMapPlace | null>(null)
  const [isSearchOpen, setSearchOpen] = React.useState(false)
  const [isFilterOpen, setFilterOpen] = React.useState(false)
  // Empty means "everything", not "nothing" — see `placesInCategories`.
  const [categories, setCategories] = React.useState<ReadonlySet<PlaceCategory>>(
    () => new Set(),
  )

  const { places: allPlaces, isLoading, hasError, refresh } = useBtcMapPlaces()

  // The map tab is never unmounted, so returning to it days later would
  // otherwise show whatever was cached when the process started. `refresh` is a
  // no-op unless the cache has actually aged out.
  useFocusEffect(refresh)

  // Memoised for the array identity as much as for the work: the clusterer
  // rebuilds its index over all ~29k points whenever this changes, so panning
  // must not hand it a fresh copy of the same list.
  const visiblePlaces = React.useMemo(
    () => placesInCategories(allPlaces, categories),
    [allPlaces, categories],
  )

  const { places, clusters, regionForCluster } = usePlaceClusters(visiblePlaces, region)

  const center = React.useMemo(
    () => ({ latitude: region.latitude, longitude: region.longitude }),
    [region.latitude, region.longitude],
  )
  const viewportRadiusKm = radiusKmForRegion(region)

  // Names are not in the offline snapshot, so they are fetched for the viewport
  // — and only once it is tight enough for labels to be legible.
  const names = useBtcMapPlaceNames({
    center,
    radiusKm: viewportRadiusKm,
    enabled: zoomForRegion(region) >= LABEL_MIN_ZOOM,
  })

  // The collision pass works in screen space, so it needs the size of the view
  // the region is drawn into — the map's own, not the window's, since the tab
  // bar below it is not map.
  const [viewport, setViewport] = React.useState<Viewport | null>(null)
  const handleLayout = React.useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    // Same size, same object: this feeds a memo that re-runs the placement.
    setViewport((current) =>
      current && current.width === width && current.height === height
        ? current
        : { width, height },
    )
  }, [])

  // Cut to the label's character budget once, here, so the collision pass and
  // the views it admits are given the very same strings. Truncating in either
  // place alone would have the boxes reserved in screen space describe a name
  // nobody draws — too wide, and neighbours dropped for room never used.
  const labelNames = React.useMemo(
    () => new Map([...names].map(([id, name]) => [id, truncateLabel(name)])),
    [names],
  )

  // Which names can be drawn without landing on one another.
  //
  // Recomputed only when the camera settles, because `region` is only written by
  // `onRegionChangeComplete` — so the names on screen mid-gesture are the ones
  // the last settled camera chose, and they resolve when the map comes to rest.
  // btcmap.org's MapLibre layer redoes this every frame and fades the difference
  // in; a fade is not available to us, since these are native marker views whose
  // opacity cannot be animated without re-rasterising every one of them.
  const labelledPlaceIds = React.useMemo(
    () =>
      viewport ? placeLabels(places, labelNames, { region, viewport }) : EMPTY_LABELS,
    [places, labelNames, region, viewport],
  )

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
    getUserRegion(async (userRegion) => {
      if (userRegion) {
        setCoords({
          latitude: userRegion.latitude,
          longitude: userRegion.longitude,
        })
      }
      if (userRegion && mapViewRef.current) {
        mapViewRef.current.animateToRegion(userRegion)
      } else if (!userRegion) {
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

  const saveCoords = React.useMemo(
    () =>
      debounce(
        (lastRegion: Region) => updateMapLastCoords(client, lastRegion),
        SAVE_COORDS_DEBOUNCE_MS,
        { trailing: true },
      ),
    [client],
  )

  React.useEffect(() => () => saveCoords.cancel(), [saveCoords])

  // Read by the cluster handler, so that panning does not hand every cluster a
  // fresh callback and re-render the lot of them.
  const regionRef = React.useRef(region)

  const handleRegionChangeComplete = React.useCallback(
    (nextRegion: Region) => {
      regionRef.current = nextRegion
      setRegion(nextRegion)
      saveCoords(nextRegion)
    },
    [saveCoords],
  )

  const handleClusterPress = React.useCallback(
    (cluster: ClusterMarkerData) => {
      mapViewRef.current?.animateToRegion(
        regionForCluster(cluster, regionRef.current),
        FLY_TO_DURATION_MS,
      )
    },
    [regionForCluster],
  )

  const handlePlacePress = React.useCallback((place: BtcMapPlace) => {
    setSelectedPlace(place)
  }, [])

  const closeSheet = React.useCallback(() => setSelectedPlace(null), [])

  // The sheet cannot open in the same breath as the search closes on iOS: both
  // are native modals, and iOS silently drops one presented while another is
  // still dismissing. So the picked place is parked here until the search
  // modal reports its dismissal finished. Android's dialogs do not collide —
  // and never report — so there the sheet opens directly instead.
  const pendingSearchPlace = React.useRef<BtcMapPlace | null>(null)

  const handleSearchDismiss = React.useCallback(() => {
    const pending = pendingSearchPlace.current
    pendingSearchPlace.current = null
    if (pending) setSelectedPlace(pending)
  }, [])

  // A result is picked from a list that may be describing somewhere off screen,
  // so the map goes to it before the sheet opens over it — otherwise closing the
  // sheet leaves the user looking at wherever they were before.
  const handleSearchSelect = React.useCallback((place: BtcMapPlace) => {
    setSearchOpen(false)

    const current = regionRef.current
    const longitudeDelta = longitudeDeltaForZoom(SEARCH_RESULT_ZOOM)
    mapViewRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        longitudeDelta,
        latitudeDelta:
          longitudeDelta *
          (current.latitudeDelta / Math.max(current.longitudeDelta, 1e-6)),
      },
      FLY_TO_DURATION_MS,
    )

    if (isIOS) {
      pendingSearchPlace.current = place
    } else {
      setSelectedPlace(place)
    }
  }, [])

  return (
    <View style={styles.viewContainer}>
      <MapView
        ref={mapViewRef}
        style={styles.map}
        onLayout={handleLayout}
        showsUserLocation={permissionsStatus === RESULTS.GRANTED}
        showsMyLocationButton={false}
        initialRegion={userLocation}
        // The basemap draws its own restaurants, shops and stations, which read
        // as merchants we vouch for and bury the ones we do. Suppressing them
        // takes both mechanisms: the style sheet is Google's and only reaches
        // Android, while iOS renders Apple Maps, which ignores it and honours
        // this prop instead.
        showsPointsOfInterests={false}
        customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light}
        onRegionChangeComplete={handleRegionChangeComplete}
        moveOnMarkerPress={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {clusters.map((cluster) => (
          <ClusterMarker
            key={`cluster-${cluster.id}`}
            cluster={cluster}
            onPress={handleClusterPress}
          />
        ))}
        {places.map((place) => (
          <PlaceMarker key={place.id} place={place} onPress={handlePlacePress} />
        ))}
        {/* Separate markers, not children of the pins: a name arriving has to
            mount something new rather than resize a pin that has already
            rasterised — see place-marker.tsx.

            Only the names that won a place in the collision pass are mounted. A
            pin whose name lost still draws; it is the name that is dropped, not
            the merchant. */}
        {places.map((place) => {
          const name = labelledPlaceIds.has(place.id)
            ? labelNames.get(place.id)
            : undefined
          return name ? (
            <PlaceLabelMarker
              key={`label-${place.id}`}
              place={place}
              name={name}
              onPress={handlePlacePress}
            />
          ) : null
        })}
      </MapView>

      <MapSearchBar
        topInset={insets.top}
        onSearchPress={() => setSearchOpen(true)}
        onFilterPress={() => setFilterOpen(true)}
        isFiltered={categories.size > 0}
      />

      {isLoading && !allPlaces.length && (
        <View style={styles.statusPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.statusText}>{LL.MapScreen.loadingPlaces()}</Text>
        </View>
      )}

      {hasError && (
        <Pressable style={styles.statusPill} onPress={refresh}>
          <GaloyIcon name="warning" size={16} color={colors.error} />
          <Text style={styles.statusText}>{LL.MapScreen.placesError()}</Text>
          <Text style={styles.retryText}>{LL.common.tryAgain()}</Text>
        </Pressable>
      )}

      {permissionsStatus !== RESULTS.UNAVAILABLE &&
        permissionsStatus !== RESULTS.LIMITED && (
          <LocationButtonCopy
            requestPermissions={requestLocationPermission}
            permissionStatus={permissionsStatus}
            centerOnUser={centerOnUser}
          />
        )}

      <OpenSettingsModal ref={openSettingsModalRef} />

      <PlaceSearchModal
        isVisible={isSearchOpen}
        center={center}
        userLocation={coords}
        viewportRadiusKm={viewportRadiusKm}
        categories={categories}
        onSelect={handleSearchSelect}
        onClose={() => setSearchOpen(false)}
        onDismiss={handleSearchDismiss}
      />

      <CategoryFilterSheet
        isVisible={isFilterOpen}
        selected={categories}
        onChange={setCategories}
        onClose={() => setFilterOpen(false)}
      />

      <PlaceSheet place={selectedPlace} userLocation={coords} onClose={closeSheet} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { topInset }: { topInset: number }) => ({
  map: {
    height: "100%",
    width: "100%",
  },

  viewContainer: { flex: 1 },

  statusPill: {
    position: "absolute",
    // Under the search bar, which now owns the top edge of the map.
    top: searchBarBottom(topInset) + 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: "90%",
  },
  statusText: {
    fontSize: 13,
    color: colors.black,
    flexShrink: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
}))
