import debounce from "lodash.debounce"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dimensions, Platform, Pressable, View } from "react-native"
import MapView, { Geojson, Region } from "react-native-maps"
import { useApolloClient } from "@apollo/client"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { MapMarker } from "@app/graphql/generated"
import MapStyles from "./map-styles.json"
import { IMarker } from "@app/screens/map-screen/btc-map-interface"
import { useArea } from "@app/components/map-components/map-hooks/use-community.ts"
import { Category } from "@app/components/map-components/categories.ts"
import { navigateToGeometry } from "@app/components/map-components/map-utils"
import { isPointCluster, supercluster, useClusterer } from "react-native-clusterer"
import ClusterComponent from "@app/components/map-components/map-elements/cluster-component.tsx"
import MarkerComponent from "@app/components/map-components/map-elements/marker-component.tsx"
import SearchBar from "./search-bar"
import SearchScreen from "./search-screen"
import { FiltersCard } from "@app/components/map-components/modals"
import BottomSheet from "@app/components/map-components/modals/bottom-sheet.tsx"
import { MerchantBottomSheet } from "@app/components/map-components/modals/merchant-bottom-sheet.tsx"
import { SuggestBusinessCard } from "@app/components/map-components/modals/suggest-business-card.tsx"
import { VerifyMerchantSheet } from "@app/components/map-components/modals/verify-merchant-sheet"
import { AreaBottomSheet } from "@app/components/map-components/modals/area-bottom-sheet"
import CommunitySearchScreen from "@app/components/map-components/community-search-screen"
import { request, RESULTS } from "react-native-permissions"
import { getUserRegion, LOCATION_PERMISSION } from "@app/screens/map-screen/functions"

type Props = {
  data?: IMarker[]
  userLocation: Region
  handlePayButton: (_: MapMarker) => void
  hasLocation?: boolean
}

const { width, height } = Dimensions.get("window")

const CLUSTER_OPTIONS = {
  radius: 50,
  maxZoom: 16,
  minPoints: 5,
  extent: 512,
}

export default function MapComponent({ data, userLocation, hasLocation }: Props) {
  const {
    theme: { mode: themeMode, colors },
  } = useTheme()
  const styles = useStyles()
  const client = useApolloClient()
  const insets = useSafeAreaInsets()

  const [locationGranted, setLocationGranted] = useState(hasLocation ?? false)

  const mapViewRef = useRef<MapView>(null)
  const pinIconRef = useRef<View>(null)
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [focusedMarker, setFocusedMarker] = React.useState<IMarker | null>(null)
  const [region, setRegion] = useState(userLocation)
  const [searchVisible, setSearchVisible] = useState(false)
  const [communitySearchVisible, setCommunitySearchVisible] = useState(false)

  const [selectedCommunityId, setSelectedCommunityId] = React.useState<number | null>(
    null,
  )
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<number | null>(null)
  const [categoryFilters, setCategoryFilters] = useState<Set<Category>>(new Set())

  type Sheet = "merchant" | "filter" | "suggest" | "verify" | "area" | null
  const [activeSheet, setActiveSheet] = useState<Sheet>(null)

  // todo handle loading state and error
  const { community, isLoading, error } = useArea(selectedCommunityId)

  useEffect(() => {
    if (!selectedMarkerId || !data) {
      return
    }
    const marker = data.find((m) => m.id === selectedMarkerId)
    if (marker) {
      setFocusedMarker(marker)
      mapViewRef.current?.animateToRegion(
        {
          latitude: marker.location.latitude,
          longitude: marker.location.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        },
        400,
      )
      setActiveSheet("merchant")
    }
  }, [data, selectedMarkerId])

  useEffect(() => {
    if (selectedCommunityId !== null) {
      setActiveSheet("area")
    }
  }, [selectedCommunityId])

  useEffect(() => {
    if (!community) return
    if (community.tags.geo_json) {
      navigateToGeometry(mapViewRef, community.tags.geo_json)
    }
  }, [community])

  const handleClusterClick = useCallback(
    (cluster: supercluster.ClusterFeature<IMarker>) => {
      const toRegion = cluster.properties.getExpansionRegion()
      mapViewRef.current?.animateToRegion(toRegion, 300)
    },
    [],
  )

  const handleMarkerSelect = useCallback((pin: IMarker) => {
    setFocusedMarker(pin)
    mapViewRef.current?.animateToRegion(
      {
        latitude: pin.location.latitude,
        longitude: pin.location.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      },
      250,
    )
    setActiveSheet("merchant")
  }, [])

  const handleCenterOnUser = useCallback(async () => {
    if (locationGranted) {
      getUserRegion((userRegion) => {
        if (userRegion) mapViewRef.current?.animateToRegion(userRegion, 500)
      })
    } else {
      const status = await request(LOCATION_PERMISSION)
      if (status === RESULTS.GRANTED) {
        setLocationGranted(true)
        getUserRegion((userRegion) => {
          if (userRegion) mapViewRef.current?.animateToRegion(userRegion, 500)
        })
      }
    }
  }, [locationGranted])

  const closeSheet = useCallback(() => setActiveSheet(null), [])

  const measurePin = useCallback(() => {
    pinIconRef.current?.measure((_x, _y, _w, h, _pageX, pageY) => {
      const pinCenterY = pageY + h / 2
      const offsetY = pinCenterY - height / 2
      const latOffset = -(offsetY / height) * region.latitudeDelta
      setPinCoords({
        latitude: region.latitude + latOffset,
        longitude: region.longitude,
      })
    })
  }, [region])

  useEffect(() => {
    if (activeSheet === "suggest") measurePin()
  }, [region, activeSheet, measurePin])

  const closeCommunitySheet = useCallback(() => {
    setSelectedCommunityId(null)
    setActiveSheet(null)
  }, [])

  const handleMapClick = useCallback((e?: { nativeEvent?: { action?: string } }) => {
    if (e?.nativeEvent?.action === "marker-press") return
    setActiveSheet(null)
    setSelectedMarkerId(null)
    setFocusedMarker(null)
  }, [])

  const allGeoPoints = useMemo<supercluster.PointFeature<IMarker>[]>(() => {
    if (!data || data.length === 0) return []
    return data.map((marker) => ({
      type: "Feature" as const,
      properties: marker,
      geometry: {
        type: "Point" as const,
        coordinates: [marker.location.longitude, marker.location.latitude] as [
          number,
          number,
        ],
      },
    }))
  }, [data])

  const categoryIndex = useMemo(() => {
    const index = new Map<Category, supercluster.PointFeature<IMarker>[]>()
    for (const point of allGeoPoints) {
      const cat = point.properties.category
      if (cat) {
        let arr = index.get(cat)
        if (!arr) {
          arr = []
          index.set(cat, arr)
        }
        arr.push(point)
      }
    }
    return index
  }, [allGeoPoints])

  const categoryFilteredGeoPoints = useMemo(() => {
    if (categoryFilters.size === 0) return allGeoPoints
    const result: supercluster.PointFeature<IMarker>[] = []
    for (const cat of categoryFilters) {
      const points = categoryIndex.get(cat)
      if (points) result.push(...points)
    }
    return result
  }, [allGeoPoints, categoryIndex, categoryFilters])

  const [points] = useClusterer<IMarker, IMarker>(
    categoryFilteredGeoPoints,
    { width, height },
    region,
    CLUSTER_OPTIONS,
  )

  const pointsFingerprint = useMemo(() => {
    return points
      .map((p) =>
        isPointCluster(p)
          ? `c${p.properties.cluster_id}:${p.properties.point_count}`
          : `m${p.properties.id}`,
      )
      .join(",")
  }, [points])

  const renderedMarkers = useMemo(() => {
    return points.map((point) => {
      if (isPointCluster(point)) {
        return (
          <ClusterComponent
            cluster={point}
            onPress={handleClusterClick}
            key={`cluster-${point.properties.cluster_id}`}
          />
        )
      }
      return (
        <MarkerComponent
          pin={point.properties}
          onSelect={handleMarkerSelect}
          key={`marker-${point.properties.id}`}
        />
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsFingerprint, handleClusterClick, handleMarkerSelect])

  const debouncedSaveCoords = useMemo(
    () =>
      debounce((newRegion: Region) => {
        updateMapLastCoords(client, newRegion)
      }, 1000),
    [client],
  )

  useEffect(() => {
    return () => {
      debouncedSaveCoords.cancel()
    }
  }, [debouncedSaveCoords])

  const communityGeoJson = useMemo(() => {
    if (!community?.tags.geo_json) return null
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: community.tags.geo_json,
        },
      ],
    }
  }, [community])

  const handleRegionChangeComplete = useCallback(
    (newRegion: Region) => {
      console.log("[map] onRegionChangeComplete", newRegion.latitude.toFixed(4))
      setRegion(newRegion)
      debouncedSaveCoords(newRegion)
    },
    [debouncedSaveCoords],
  )

  return (
    <View style={styles.viewContainer}>
      <MapView
        ref={mapViewRef}
        onMapReady={() => console.log("[map] onMapReady, data:", data?.length ?? 0)}
        onRegionChangeComplete={handleRegionChangeComplete}
        style={styles.map}
        customMapStyle={
          Platform.OS === "android"
            ? themeMode === "dark"
              ? MapStyles.dark
              : MapStyles.light
            : undefined
        }
        onPress={handleMapClick}
        initialRegion={userLocation}
        moveOnMarkerPress={false}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        mapType="standard"
        loadingEnabled={false}
      >
        {renderedMarkers}
        {communityGeoJson && (
          <Geojson
            geojson={communityGeoJson}
            strokeColor="#000000"
            strokeWidth={2}
            fillColor="rgba(247, 147, 26, 0.15)"
          />
        )}
      </MapView>

      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        <SearchBar
          onPress={() => {
            setActiveSheet(null)
            setTimeout(() => setSearchVisible(true), 300)
          }}
        />
        <Pressable
          onPress={() => {
            setActiveSheet(null)
            setTimeout(() => setCommunitySearchVisible(true), 300)
          }}
          style={styles.iconButton}
        >
          <GaloyIcon name="people-2" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => {
            setSearchVisible(false)
            setCommunitySearchVisible(false)
            setActiveSheet("filter")
          }}
          style={styles.iconButton}
        >
          <GaloyIcon name="list" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <Pressable onPress={() => setActiveSheet("suggest")} style={styles.addToMapButton}>
        <Text style={styles.addToMapText}>Add to map</Text>
        <GaloyIcon name="plus" size={16} color={colors.primary} />
      </Pressable>

      <Pressable onPress={handleCenterOnUser} style={styles.centerButton}>
        <GaloyIcon name="gps" size={20} color={colors.primary} />
      </Pressable>

      {activeSheet === "suggest" && (
        <View style={styles.staticMarkerContainer} pointerEvents="none">
          <View style={styles.placeMarkerLabel}>
            <Text style={styles.placeMarkerText}>Place the marker</Text>
          </View>
          <View ref={pinIconRef} onLayout={measurePin}>
            <GaloyIcon name="map" size={24} color={colors.primary} />
          </View>
        </View>
      )}

      <BottomSheet
        visible={activeSheet === "suggest"}
        onClose={closeSheet}
        peekHeight={400}
      >
        <SuggestBusinessCard
          closeModal={closeSheet}
          mapCenter={pinCoords ?? { latitude: region.latitude, longitude: region.longitude }}
        />
      </BottomSheet>

      {searchVisible && (
        <SearchScreen
          onClose={() => setSearchVisible(false)}
          setSelectedMarker={setSelectedMarkerId}
          hasLocation={hasLocation}
          mapCenter={{ latitude: region.latitude, longitude: region.longitude }}
        />
      )}

      {communitySearchVisible && (
        <CommunitySearchScreen
          onClose={() => setCommunitySearchVisible(false)}
          setCommunityId={setSelectedCommunityId}
        />
      )}

      <BottomSheet visible={activeSheet === "filter"} onClose={closeSheet}>
        <FiltersCard filters={categoryFilters} setFilters={setCategoryFilters} />
      </BottomSheet>

      <MerchantBottomSheet
        visible={activeSheet === "merchant"}
        onClose={closeSheet}
        onVerify={() => setActiveSheet("verify")}
        selectedMarker={focusedMarker}
      />

      <VerifyMerchantSheet
        visible={activeSheet === "verify"}
        onClose={closeSheet}
        merchantName={focusedMarker?.name ?? undefined}
      />

      <AreaBottomSheet
        visible={activeSheet === "area"}
        onClose={closeCommunitySheet}
        community={community}
        isLoading={isLoading}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  map: {
    height: "100%",
    width: "100%",
  },
  viewContainer: { flex: 1 },
  topRow: {
    position: "absolute",
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 99,
  },
  iconButton: {
    backgroundColor: colors.white,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  addToMapButton: {
    position: "absolute",
    left: 8,
    bottom: 12,
    zIndex: 99,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
    maxHeight: 40,
  },
  addToMapText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.black,
  },
  centerButton: {
    position: "absolute",
    right: 8,
    bottom: 12,
    zIndex: 99,
    backgroundColor: colors.white,
    borderRadius: 22,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  staticMarkerContainer: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  placeMarkerLabel: {
    backgroundColor: colors.white,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  placeMarkerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.black,
    textAlign: "center",
  },
}))
