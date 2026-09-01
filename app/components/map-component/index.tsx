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
  PlaceSubmission,
  placesInCategories,
  useBtcMapPlaceNames,
  useBtcMapPlaces,
  useSubmitBtcMapPlace,
} from "@app/btcmap"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { useI18nContext } from "@app/i18n/i18n-react"
import { LOCATION_PERMISSION, getUserRegion } from "@app/screens/map-screen/functions"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"
import { generateSecureRandomUUID } from "@app/utils/uuid"
import { useFocusEffect } from "@react-navigation/native"
import { isIOS } from "@rn-vui/base"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { AddPlaceModal } from "./add-place-modal"
import { CategoryFilterSheet } from "./category-filter-sheet"
import { ClusterMarker, ClusterMarkerData } from "./cluster-marker"
import { Viewport, placeLabels } from "./label-collision"
import LocationButtonCopy from "./location-button-copy"
import { MapSearchBar, searchBarBottom } from "./map-search-bar"
import MapStyles from "./map-styles.json"
import { OpenSettingsElement, OpenSettingsModal } from "./open-settings-modal"
import { truncateLabel } from "./marker-layout"
import { PlaceLabelMarker } from "./place-label-marker"
import { PlaceLocator, locatorBarTop } from "./place-locator"
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

  // Adding a place is a level-two custodial-account feature: the submission
  // goes to BTC Map through our own backend, which needs a Blink session
  // behind it and rejects anything below account level two.
  // `useIsSelfCustodialAccount` rather than `useActiveWallet().isSelfCustodial`
  // so the button does not flash into view during the renders where the
  // self-custodial SDK has not reported yet. The kill switch gates it too:
  // emptying the pins while submissions keep flowing to the backend is the
  // outcome `btcMapPlacesEnabled` exists to avoid.
  const isAuthed = useIsAuthed()
  const isSelfCustodialAccount = useIsSelfCustodialAccount()
  const { isAtLeastLevelTwo } = useLevel()
  const { btcMapPlacesEnabled } = useRemoteConfig()
  const canAddPlace =
    isAuthed && !isSelfCustodialAccount && isAtLeastLevelTwo && btcMapPlacesEnabled

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
  // Placing the pin, then describing what is under it. Null is neither.
  const [addStep, setAddStep] = React.useState<"locating" | "describing" | null>(null)
  const isAddingPlace = addStep !== null
  const isLocatingPlace = addStep === "locating"
  const isDescribingPlace = addStep === "describing"
  // Read by the submit handler after its awaits, when `addStep` may have moved
  // on, and by the cluster handler, which has to stay a stable callback. Synced
  // in an effect rather than during render: writing a ref in the render body is
  // impure under concurrent rendering, and every reader runs after the commit.
  const addStepRef = React.useRef(addStep)
  React.useEffect(() => {
    addStepRef.current = addStep
  }, [addStep])
  const [pinnedLocation, setPinnedLocation] = React.useState<LatLng | null>(null)
  // One attempt at adding a place. It keys the form, so what was typed survives
  // a trip back to the map to move the pin but never outlives the attempt it
  // was typed into.
  const [addSession, setAddSession] = React.useState(0)
  // Read by the submit handler after its awaits, when the attempt on screen may
  // be a later one than the one that was sent. Synced in an effect, like
  // `addStepRef` above.
  const addSessionRef = React.useRef(addSession)
  React.useEffect(() => {
    addSessionRef.current = addSession
  }, [addSession])
  // The idempotency key of the attempt: the backend deduplicates submissions on
  // it, so every retry of one attempt reuses it and a new attempt mints one.
  // Null until the attempt's first send — minting one is async, because a UUID's
  // randomness has to come from the platform CSPRNG (see `utils/uuid.ts`), and
  // an attempt abandoned before submitting never needs one.
  const submissionIdRef = React.useRef<string | null>(null)
  // Empty means "everything", not "nothing" — see `placesInCategories`.
  const [categories, setCategories] = React.useState<ReadonlySet<PlaceCategory>>(
    () => new Set(),
  )

  const { places: allPlaces, isLoading, hasError, refresh } = useBtcMapPlaces()
  const { submitPlace } = useSubmitBtcMapPlace()

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

  // The camera is somewhere for the whole of a fling or a fly-to, not only once
  // it stops, and confirming the pin reads this ref — so it follows the camera
  // rather than its last resting place. Nothing but the ref: this fires every
  // frame of a gesture, and re-rendering ~29k points' worth of markers on each
  // of them is what `region` being written only on settle exists to avoid.
  const handleRegionChange = React.useCallback((nextRegion: Region) => {
    regionRef.current = nextRegion
  }, [])

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
      // Same reason the pins go quiet below: while the pin is being placed the
      // map is being aimed, and flying off to a cluster takes it off whatever
      // was being aimed at. From the ref, so that this stays one callback.
      if (addStepRef.current !== null) return
      mapViewRef.current?.animateToRegion(
        regionForCluster(cluster, regionRef.current),
        FLY_TO_DURATION_MS,
      )
    },
    [regionForCluster],
  )

  // While the pin is being placed, a tap on the map is aiming rather than
  // asking about somewhere that is already on it, so the existing pins go quiet
  // instead of opening a sheet over the thing being aimed.
  const handlePlacePress = React.useCallback((place: BtcMapPlace) => {
    // From the ref, like the cluster handler's: a callback keyed on `addStep`
    // would change identity on every step transition and re-render the markers.
    if (addStepRef.current !== null) return
    setSelectedPlace(place)
  }, [])

  const startAddingPlace = React.useCallback(() => {
    setSelectedPlace(null)
    setPinnedLocation(null)
    setAddSession((session) => session + 1)
    // The next attempt's id is minted on its first send — see the ref above.
    submissionIdRef.current = null
    setAddStep("locating")
  }, [])

  // The pin never moves, so where it points is the centre of whatever region
  // the map has settled on. Read from the ref rather than the state so a
  // confirmation lands on the region the user is actually looking at.
  const confirmPlaceLocation = React.useCallback(() => {
    const { latitude, longitude } = regionRef.current
    setPinnedLocation({ latitude, longitude })
    setAddStep("describing")
  }, [])

  /**
   * Sends the place and answers the form with what to say about it.
   *
   * A failure is the form's to report rather than this screen's: the form is a
   * native modal over everything, so a toast raised from under it is drawn
   * under it too — see `add-place-modal.tsx`. Success is the other way round,
   * since by then the form is gone and there is nothing left to say it on.
   *
   * Both awaits are long enough for the attempt underneath to be abandoned and
   * another one started, so what comes back is applied to the form only while
   * it still belongs to the attempt on screen. The success toast is the one
   * exception: it announces a place BTC Map now has, which stays true whatever
   * the form has done since.
   */
  const handlePlaceSubmit = React.useCallback(
    async (submission: PlaceSubmission): Promise<string | null> => {
      const attempt = addSessionRef.current

      let submissionId = submissionIdRef.current
      if (!submissionId) {
        try {
          submissionId = await generateSecureRandomUUID()
        } catch (mintingError) {
          // No id, no send: without the idempotency key the backend cannot
          // deduplicate, so the place must not go out without one. What failed
          // here is the device's CSPRNG, not the connection, so the form gets
          // the generic error rather than connection advice — and the failure
          // is a defect worth a non-fatal, not a silent catch.
          reportError("mintBtcMapSubmissionId", mintingError)
          return LL.errors.generic()
        }
        // Abandoned while the id was being minted. Nothing to send — and the id
        // must not be left in the ref for the next attempt to pick up, since
        // the backend deduplicates on it and would take the next place as an
        // edit of this one.
        if (addSessionRef.current !== attempt) return null
        // No race to atomically avoid: the form's in-flight guard means only
        // one send per attempt is ever between its first line and this one.
        // eslint-disable-next-line require-atomic-updates
        submissionIdRef.current = submissionId
      }
      const outcome = await submitPlace(submission, submissionId)

      // Success is announced even when the attempt that sent it has since been
      // abandoned: the place is on its way to BTC Map either way, and an
      // unannounced success invites a resubmission under a new submissionId —
      // which the backend can no longer deduplicate. The toast is app-level so
      // it is visible once the form is closed; when a later attempt's form is
      // open it is drawn behind that modal (see `add-place-modal.tsx`), which
      // is the price of not losing the confirmation entirely.
      if (outcome.submitted) {
        toastShow({
          message: (translations) => translations.MapScreen.placeSubmitted(),
          LL,
          type: "success",
        })

        // The attempt is over, whatever step it is on: the answer can land
        // after the form went back to moving the pin, and leaving the attempt
        // open then would let its next send arrive as an edit of the place BTC
        // Map just took. Only the attempt that sent it closes, though — a
        // later one is another place's business.
        if (addSessionRef.current === attempt) {
          setAddStep(null)
          setPinnedLocation(null)
        }
        return null
      }

      // A failure belongs to the form that sent it: a response for an attempt
      // that is no longer the one on screen closes nothing and reports nothing
      // over a later attempt.
      if (addStepRef.current !== "describing" || addSessionRef.current !== attempt) {
        return null
      }

      // The form stays open with the reason on it: what was typed is exactly
      // what a retry should send, under the same submissionId. A refusal is
      // about the place and a dropped request is about the connection, so they
      // do not share a sentence — but neither of them borrows the backend's,
      // which only ever comes back in English.
      return outcome.refused
        ? LL.MapScreen.placeRefused()
        : LL.MapScreen.placeSubmissionFailed()
    },
    [LL, submitPlace],
  )

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
        onRegionChange={handleRegionChange}
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

      {/* Both are about reading the map, and neither belongs over a map that
          is being used to point at something. */}
      {!isAddingPlace && (
        <>
          <MapSearchBar
            topInset={insets.top}
            onSearchPress={() => setSearchOpen(true)}
            onFilterPress={() => setFilterOpen(true)}
            isFiltered={categories.size > 0}
          />

          {canAddPlace && (
            <Pressable
              testID="open-add-place"
              style={styles.addPlace}
              onPress={startAddingPlace}
              accessibilityRole="button"
            >
              <GaloyIcon name="plus" size={16} color={colors.primary} />
              <Text style={styles.addPlaceText}>{LL.MapScreen.addPlace()}</Text>
            </Pressable>
          )}
        </>
      )}

      {isLocatingPlace && (
        <PlaceLocator
          onConfirm={confirmPlaceLocation}
          onCancel={() => setAddStep(null)}
        />
      )}

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
            // Centring on yourself and then nudging the pin onto your own shop
            // is the common way to place one, so this stays reachable while the
            // locator's bar has the bottom of the map.
            bottom={isLocatingPlace ? locatorBarTop(insets.bottom) + 10 : undefined}
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

      <AddPlaceModal
        key={addSession}
        isVisible={isDescribingPlace}
        location={pinnedLocation}
        onSubmit={handlePlaceSubmit}
        onChangeLocation={() => setAddStep("locating")}
        onClose={() => {
          setAddStep(null)
          setPinnedLocation(null)
        }}
      />
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
  addPlace: {
    position: "absolute",
    left: 8,
    bottom: 12,
    zIndex: 99,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addPlaceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },
}))
