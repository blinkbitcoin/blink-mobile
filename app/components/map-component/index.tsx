import debounce from "lodash.debounce"
import React, { useRef, useState } from "react"
import { View } from "react-native"
import MapView, { MapMarker as MapMarkerType, Marker, Region } from "react-native-maps"

import { useApolloClient } from "@apollo/client"
import { updateMapLastCoords } from "@app/graphql/client-only-query"
import { MapMarker } from "@app/graphql/generated"
import { ListItem, makeStyles, useTheme, Text } from "@rneui/themed"

import ButtonMapsContainer from "./button-maps-container"
import MapStyles from "./map-styles.json"
import { OpenBottomModal, OpenBottomModalElement, TModal } from "./modals/modal-container"
import Icon from "react-native-vector-icons/Ionicons"
import { ICluster, IMarker } from "@app/screens/map-screen/btc-map-interface"
import SuperCluster from "react-native-maps-super-cluster"
import iconMap from "./iconMap"
import PinIcon from "./pinIcon"

type Props = {
  data?: IMarker[]
  userLocation?: Region
  handleMapPress: () => void
  handleMarkerPress: (_: MapMarker) => void
  focusedMarker: MapMarker | null
  focusedMarkerRef: React.MutableRefObject<MapMarkerType | null>
  handleCalloutPress: (_: MapMarker) => void
}

export default function MapComponent({
  data,
  userLocation,
  handleMapPress,
  handleMarkerPress,
  focusedMarker,
  focusedMarkerRef,
  handleCalloutPress,
}: Props) {
  const {
    theme: { colors, mode: themeMode },
  } = useTheme()
  const styles = useStyles()
  const client = useApolloClient()

  const mapViewRef = useRef<MapView>(null)
  const openBottomModalRef = React.useRef<OpenBottomModalElement>(null)

  // toggle modal from inside modal component instead of here in the parent
  const toggleModal = React.useCallback(
    (type: TModal) => openBottomModalRef.current?.toggleVisibility(type),
    [],
  )

  const debouncedHandleRegionChange = React.useRef(
    debounce((region: Region) => updateMapLastCoords(client, region), 1000, {
      trailing: true,
    }),
  ).current

  const renderCluster = (cluster: ICluster) => {
    const pointCount = cluster.pointCount,
      coordinate = cluster.coordinate,
      clusterId = cluster.clusterId

    return (
      <Marker identifier={`cluster-${clusterId}`} coordinate={coordinate}>
        <View style={styles.clusterContainer}>
          <Text style={styles.clusterText}>{pointCount}</Text>
        </View>
      </Marker>
    )
  }

  const renderMarker = (pin: IMarker) => {
    const iconName: string = pin?.tags?.["icon:android"]
    return (
      <Marker identifier={`pin-${pin.id}`} key={pin.id} coordinate={pin.location}>
        <View style={styles.iconContainer}>
          <PinIcon size={35} />
          <Icon
            name={iconMap[iconName]}
            size={18}
            color="#FFFFFF"
            style={styles.iconOverlay}
          />
        </View>
      </Marker>
    )
  }

  return (
    <View style={styles.viewContainer}>
      <SuperCluster
        ref={mapViewRef}
        data={data}
        renderMarker={renderMarker}
        renderCluster={renderCluster}
        onRegionChange={debouncedHandleRegionChange}
        style={styles.map}
        customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light}
        accessor="location"
        initialRegion={userLocation}
      />
      {/* <MapView
        onPress={handleMapPress}
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
        
      </MapView> */}

      <ButtonMapsContainer
        position="topCenter"
        event={() => toggleModal("locationEvent")}
      >
        <ListItem containerStyle={styles.list}>
          <Icon name="location-outline" color="white" size={15} />
          <ListItem.Title>Bitcoint Berlin, E</ListItem.Title>
          <Icon name="chevron-down-outline" color="white" />
        </ListItem>
      </ButtonMapsContainer>
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
      <OpenBottomModal ref={openBottomModalRef} />
    </View>
  )
}

const useStyles = makeStyles(() => ({
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
