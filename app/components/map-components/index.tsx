import debounce from "lodash.debounce"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dimensions, View } from "react-native"
import MapView, { Region } from "react-native-maps"
import { useApolloClient } from "@apollo/client"
import { ListItem, makeStyles, useTheme } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"

import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { MapMarker } from "@app/graphql/generated"
import ButtonMapsContainer from "./button-maps-container"
import MapStyles from "./map-styles.json"
import { OpenBottomModal, OpenBottomModalElement, TModal } from "./modals/modal-container"
import { IMarker } from "@app/screens/map-screen/btc-map-interface"
import { useArea } from "@app/components/map-components/map-hooks/use-community.ts"
import { Category } from "@app/components/map-components/categories.ts"
import {
  isPointInArea,
  navigateToGeometry,
} from "@app/components/map-components/map-utils"
import { isPointCluster, supercluster, useClusterer } from "react-native-clusterer"
import ClusterComponent from "@app/components/map-components/map-elements/cluster-component.tsx"
import MarkerComponent from "@app/components/map-components/map-elements/marker-component.tsx"
import { Geometry } from "geojson"
type Props = {
  data?: IMarker[]
  userLocation: Region
  handlePayButton: (_: MapMarker) => void
}

const { width, height } = Dimensions.get("window")

const CLUSTER_OPTIONS = {
  radius: 50,
  maxZoom: 16,
  minPoints: 2,
  extent: 512,
}

export default function MapComponent({ data, userLocation }: Props) {
  const {
    theme: { mode: themeMode },
  } = useTheme()
  const styles = useStyles()
  const client = useApolloClient()

  const mapViewRef = useRef<MapView>(null)
  const [focusedMarker, setFocusedMarker] = React.useState<IMarker | null>(null)
  const [region, setRegion] = useState(userLocation)
  const [nameField, setNameField] = useState<string | null>(null)

  const openBottomModalRef = React.useRef<OpenBottomModalElement>(null)
  const [selectedCommunityId, setSelectedCommunityId] = React.useState<number | null>(
    null,
  )
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<number | null>(null)
  const [categoryFilters, setCategoryFilters] = useState<Set<Category>>(new Set())

  const toggleModal = React.useCallback(
    (type: TModal) => openBottomModalRef.current?.toggleVisibility(type),
    [],
  )
  // todo handle loading state and error
  const { community, isLoading, error } = useArea(selectedCommunityId)

  useEffect(() => {
    if (!selectedMarkerId || !data) {
      return
    }
    const marker = data.find((m) => m.id === selectedMarkerId)
    if (marker) {
      setFocusedMarker(marker)
      toggleModal("locationEvent")
    }
  }, [selectedMarkerId])

  useEffect(() => {
    if (!community && !focusedMarker) {
      return
    }
    setNameField(community?.tags.name ?? focusedMarker?.name ?? null)
    if (community && community.tags.geo_json) {
      navigateToGeometry(mapViewRef, community.tags.geo_json)
    }
  }, [community, focusedMarker])

  const handleClusterClick = useCallback(
    (cluster: supercluster.ClusterFeature<IMarker>) => {
      const toRegion = cluster.properties.getExpansionRegion()
      mapViewRef.current?.animateToRegion(toRegion, 500)
    },
    [],
  )

  const handleMarkerSelect = useCallback((pin: IMarker) => {
    setFocusedMarker(pin)
    mapViewRef.current?.animateCamera({ center: pin.location }, { duration: 500 })
    toggleModal("locationEvent")
  }, [])

  // Pre-compute all GeoJSON points once (reference, no spread copy)
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

  // Pre-build category index for O(1) lookups per category
  const categoryIndex = useMemo(() => {
    const index = new Map<Category, supercluster.PointFeature<IMarker>[]>()
    for (const point of allGeoPoints) {
      const cat = point.properties.category
      if (cat != null) {
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

  // Category filter: uses index instead of scanning 26k items
  const categoryFilteredGeoPoints = useMemo(() => {
    if (categoryFilters.size === 0) return allGeoPoints
    const result: supercluster.PointFeature<IMarker>[] = []
    for (const cat of categoryFilters) {
      const points = categoryIndex.get(cat)
      if (points) result.push(...points)
    }
    return result
  }, [allGeoPoints, categoryIndex, categoryFilters])

  // FIXME - this is unfortunately freezing the UI on weaker phones
  const filteredGeoPoints = useMemo(() => {
    if (!community) return categoryFilteredGeoPoints
    if (categoryFilteredGeoPoints.length === 0 || !community.tags.geo_json) return []
    return categoryFilteredGeoPoints.filter((p) =>
      isPointInArea(p.properties.location, community.tags.geo_json!),
    )
  }, [community, categoryFilteredGeoPoints])

  const [points] = useClusterer<IMarker, IMarker>(
    filteredGeoPoints,
    { width, height },
    region,
    CLUSTER_OPTIONS,
  )

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
  }, [points, handleClusterClick, handleMarkerSelect])

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

  const handleRegionChange = useCallback(
    (newRegion: Region) => {
      setRegion(newRegion)
      debouncedSaveCoords(newRegion)
    },
    [debouncedSaveCoords],
  )

  return (
    <View style={styles.viewContainer}>
      <MapView
        ref={mapViewRef}
        // onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChange}
        style={styles.map}
        customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light}
        initialRegion={userLocation}
        moveOnMarkerPress={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#666666"
        loadingBackgroundColor="#eeeeee"
      >
        {renderedMarkers}
      </MapView>

      {nameField && (
        <ButtonMapsContainer
          key={focusedMarker?.id}
          position="topCenter"
          event={() => {
            // moveToFocusedMarker()
            toggleModal("locationEvent")
          }}
        >
          <ListItem containerStyle={styles.list}>
            <Icon
              name="close"
              color="white"
              size={15}
              onPress={() => {
                setNameField(null)
                setSelectedCommunityId(null)
              }}
            />
            <Icon name="location-outline" color="white" size={15} />
            <ListItem.Title
              ellipsizeMode="tail"
              numberOfLines={1}
              style={styles.listTitle}
            >
              {nameField}
            </ListItem.Title>
            <Icon name="chevron-down-outline" color="white" />
          </ListItem>
        </ButtonMapsContainer>
      )}

      <ButtonMapsContainer
        event={() => toggleModal("filter")}
        position="LeftLv1"
        iconName="options-outline"
      />
      <ButtonMapsContainer
        event={() => toggleModal("search")}
        position="LeftLv2"
        iconName="search"
      />
      <OpenBottomModal
        ref={openBottomModalRef}
        focusedMarker={focusedMarker}
        setFocusedMarkerId={setSelectedMarkerId}
        setSelectedCommunityId={setSelectedCommunityId}
        filters={categoryFilters}
        setFilters={setCategoryFilters}
      />
    </View>
  )
}

export const useStyles = makeStyles(() => ({
  map: {
    height: "100%",
    width: "100%",
  },
  list: {
    padding: 0,
    margin: 0,
    fontSize: "0.5rem",
    backgroundColor: "transparent",
  },
  listTitle: {
    maxWidth: 200,
  },

  viewContainer: { flex: 1 },

  clusterContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4f378c",
    justifyContent: "center",
    alignItems: "center",
    // borderWidth: 6,
    // borderColor: "#4f378cb3"
  },
  clusterBubble: {
    backgroundColor: "white",
    padding: 5,
    borderRadius: 15,
  },
  clusterText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  iconOverlay: {
    position: "absolute",
    top: 10, // ajusta según el pin
    alignSelf: "center",
  },
}))
