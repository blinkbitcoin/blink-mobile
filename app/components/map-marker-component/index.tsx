import { useEffect, useRef } from "react"
import { Dimensions, View } from "react-native"
import {
  Callout,
  CalloutSubview,
  MapMarker as MapMarkerType,
  Marker,
} from "react-native-maps"

import { MapMarker } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"
import { Text, makeStyles } from "@rn-vui/themed"

/*
  In order to increase performance, markers are initially rendered without content in the callout.
  Only after being pressed does the content render, and then the callout is shown by a method call
  from the component's ref
*/

type Props = {
  item: MapMarker
  color: string
  handleMarkerPress: (_item: MapMarker, _ref?: MapMarkerType) => void
  handleCalloutPress: (item: MapMarker) => void
  isFocused: boolean
}

export default function MapMarkerComponent({
  item,
  color,
  handleMarkerPress,
  handleCalloutPress,
  isFocused,
}: Props) {
  const ref = useRef<MapMarkerType>(null)
  const { LL } = useI18nContext()
  const styles = useStyles()

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.showCallout()
    }
  }, [isFocused])

  return (
    <Marker
      id={item.username}
      ref={ref}
      coordinate={item.mapInfo.coordinates}
      pinColor={color}
      onPress={() =>
        handleMarkerPress(item, isIos && ref.current ? ref.current : undefined)
      }
      stopPropagation
    >
      <Callout tooltip onPress={() => handleCalloutPress(item)}>
        {isFocused && (
          <View style={styles.border}>
            <View style={styles.customView}>
              <Text type="h1" style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                {item.mapInfo.title}
              </Text>
              {isIos ? (
                <CalloutSubview onPress={() => handleCalloutPress(item)}>
                  <View style={styles.pseudoButton}>
                    <Text style={styles.text}>{LL.MapScreen.payBusiness()}</Text>
                  </View>
                </CalloutSubview>
              ) : (
                <View style={styles.pseudoButton}>
                  <Text style={styles.text}>{LL.MapScreen.payBusiness()}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Callout>
    </Marker>
  )
}

const { width: screenWidth } = Dimensions.get("window")

const useStyles = makeStyles(({ colors }) => ({
  border: {
    maxWidth: screenWidth,
    overflow: "hidden",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.grey4,
    padding: 10,
    backgroundColor: colors.white,
  },

  customView: {
    alignItems: "center",
    rowGap: 10,
  },

  pseudoButton: {
    backgroundColor: colors.primary3,
    borderRadius: 25,
    width: 200,
  },

  map: {
    height: "100%",
    width: "100%",
  },

  title: { color: colors.black, textAlign: "center" },

  text: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.white,
    margin: 8,
    textAlign: "center",
  },
}))
